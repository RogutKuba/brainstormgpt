import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from 'cloudflare:workers';
import { AppContext } from '..';
import {
  getDbConnectionFromEnv,
  takeUnique,
  takeUniqueOrThrow,
} from '../db/client';
import { crawledPageTable } from '../db/crawledPage.db';
import { and, count, eq } from 'drizzle-orm';
import { NonRetryableError } from 'cloudflare:workflows';
import { PageChunkEntity, pageChunkTable } from '../db/pageChunk.db';
import { generateId, generateTlBindingId, generateTlShapeId } from '../lib/id';
import { SummaryService } from '../service/Summary.service';
import { LinkShape } from '../shapes/Link.shape';
import { PredictionShape } from '../shapes/Prediction.shape';
import { IndexKey, TLArrowBinding, TLArrowShape } from 'tldraw';

export type ChunkWorkflowParams = {
  crawledPageId: string;
  shapeId: string;
  workspaceId: string;
};

/**
 * ChunkWorkflow is a workflow that chunks a page into smaller chunks.
 * Needs to create
 * - pageSummary
 *    - gist
 *    - keyPoints
 *    - detailedSummary
 *    - mentions
 * - pageChunks
 *    - chunkType
 *    - content
 */
export class ChunkWorkflow extends WorkflowEntrypoint<
  AppContext['Bindings'],
  ChunkWorkflowParams
> {
  async run(event: WorkflowEvent<ChunkWorkflowParams>, step: WorkflowStep) {
    const { crawledPageId, shapeId, workspaceId } = event.payload;

    try {
      const existingCrawledPage = await step.do(
        'get-crawled-page',
        async () => {
          const db = getDbConnectionFromEnv(this.env);
          const crawledPage = await db
            .select({
              id: crawledPageTable.id,
              url: crawledPageTable.url,
              title: crawledPageTable.title,
              description: crawledPageTable.description,
            })
            .from(crawledPageTable)
            .where(
              and(
                eq(crawledPageTable.id, crawledPageId),
                eq(crawledPageTable.status, 'success')
              )
            )
            .then(takeUnique);
          return crawledPage;
        }
      );

      if (!existingCrawledPage) {
        throw new NonRetryableError(
          `Crawled page ${crawledPageId} not found or was not successful`
        );
      }

      await step.do('convert-content-to-chunks', async () => {
        const db = getDbConnectionFromEnv(this.env);

        const crawledPage = await db
          .select({
            url: crawledPageTable.url,
            markdown: crawledPageTable.markdown,
            html: crawledPageTable.html,
          })
          .from(crawledPageTable)
          .where(
            and(
              eq(crawledPageTable.id, crawledPageId),
              eq(crawledPageTable.status, 'success')
            )
          )
          .then(takeUniqueOrThrow);

        // if url already exists for the url, we can skip the chunking
        const existingPageChunk = await db
          .select({
            count: count(),
          })
          .from(pageChunkTable)
          .where(eq(pageChunkTable.url, crawledPage.url))
          .then(takeUnique);

        if (existingPageChunk && existingPageChunk.count > 0) {
          return;
        }

        // convert the markdown to chunks
        const chunks = await convertMarkdownToChunks(crawledPage.markdown);

        // insert the chunks into the database
        const chunkEntities: PageChunkEntity[] = chunks.map((chunk, index) => ({
          id: generateId('pageChunk'),
          createdAt: new Date().toISOString(),
          workspaceId,
          url: crawledPage.url,
          content: chunk.content,
          type: chunk.type,
          index,
        }));

        await db.insert(pageChunkTable).values(chunkEntities);
      });

      // create the page summary
      await step.do('create-page-summary', async () => {
        await SummaryService.createPageSummary({
          crawledPageUrl: existingCrawledPage.url,
          env: this.env,
        });
      });

      // Generate branch predictions and add them to the workspace
      const predictions = await step.do(
        'generate-branch-predictions',
        async () => {
          // Generate branch predictions
          const _predictions = await SummaryService.generateBranchPredictions({
            crawledPageUrl: existingCrawledPage.url,
            env: this.env,
          });
          return _predictions;
        }
      );

      // Update the shape to include predictions instead of creating separate shapes
      await step.do('update-shape-with-predictions', async () => {
        // Get the durable object for this workspace
        const workspaceDoId =
          this.env.TLDRAW_DURABLE_OBJECT.idFromName(workspaceId);
        const workspaceDo = this.env.TLDRAW_DURABLE_OBJECT.get(workspaceDoId);

        // Get the original shape
        // @ts-ignore
        const shape = (await workspaceDo.getShape(shapeId)) as LinkShape;
        if (shape.type !== 'link') return;

        // Update the shape with predictions and success status
        const updatedShape: LinkShape = {
          ...shape,
          props: {
            ...shape.props,
            status: 'success',
            isLoading: false,
            predictions,
          },
        };

        await workspaceDo.updateShape(updatedShape);
      });
    } catch (error) {
      console.error('Error in ChunkWorkflow:', error);

      const workspaceDoId =
        this.env.TLDRAW_DURABLE_OBJECT.idFromName(workspaceId);
      const workspaceDo = this.env.TLDRAW_DURABLE_OBJECT.get(workspaceDoId);

      // @ts-ignore
      const shape = (await workspaceDo.getShape(shapeId)) as any as LinkShape;

      if (shape) {
        const updatedShape = {
          ...shape,
          props: {
            ...shape.props,
            status: 'error',
            isLoading: false,
            predictions: [], // Empty predictions on error
          },
        };

        await workspaceDo.updateShape(updatedShape);
      }

      // Re-throw the original error
      throw error;
    }
  }
}

interface Chunk {
  content: string;
  type: 'heading' | 'paragraph' | 'list' | 'code' | 'other';
  metadata?: {
    headingLevel?: number;
    codeLanguage?: string;
  };
}

const convertMarkdownToChunks = async (markdown: string): Promise<Chunk[]> => {
  // Count approximate words to determine document size
  const wordCount = markdown.split(/\s+/).length;

  // For small documents, keep as a single chunk
  if (wordCount < 1000) {
    return processRawBlocks(markdown.split(/\n{2,}/));
  }

  // For medium and large documents, split by headings
  const mainSections = splitByMainHeadings(markdown);

  if (wordCount <= 3000) {
    // For medium docs, split by main headings only
    return mainSections.flatMap((section) =>
      processRawBlocks(section.split(/\n{2,}/))
    );
  } else {
    // For large docs, split by main headings and then by subheadings if needed
    return mainSections.flatMap((section) => {
      // If section is too large, split further by subheadings
      if (section.split(/\s+/).length > 1000) {
        const subSections = splitBySubHeadings(section);
        return subSections.flatMap((subSection) =>
          processRawBlocks(subSection.split(/\n{2,}/))
        );
      }
      return processRawBlocks(section.split(/\n{2,}/));
    });
  }
};

// Helper function to split markdown by main headings (# Heading)
const splitByMainHeadings = (markdown: string): string[] => {
  const mainHeadingRegex = /^# .+$/m;

  // If no main headings, return the whole document
  if (!mainHeadingRegex.test(markdown)) {
    return [markdown];
  }

  // Split by main headings
  const sections: string[] = [];
  const lines = markdown.split('\n');
  let currentSection: string[] = [];

  lines.forEach((line) => {
    if (/^# .+$/.test(line) && currentSection.length > 0) {
      sections.push(currentSection.join('\n'));
      currentSection = [line];
    } else {
      currentSection.push(line);
    }
  });

  // Add the last section
  if (currentSection.length > 0) {
    sections.push(currentSection.join('\n'));
  }

  return sections;
};

// Helper function to split markdown by subheadings (## or ### Heading)
const splitBySubHeadings = (markdown: string): string[] => {
  const subHeadingRegex = /^#{2,3} .+$/m;

  // If no subheadings, return the whole section
  if (!subHeadingRegex.test(markdown)) {
    return [markdown];
  }

  // Split by subheadings
  const sections: string[] = [];
  const lines = markdown.split('\n');
  let currentSection: string[] = [];

  lines.forEach((line) => {
    if (/^#{2,3} .+$/.test(line) && currentSection.length > 0) {
      sections.push(currentSection.join('\n'));
      currentSection = [line];
    } else {
      currentSection.push(line);
    }
  });

  // Add the last section
  if (currentSection.length > 0) {
    sections.push(currentSection.join('\n'));
  }

  return sections;
};

// Process raw blocks into chunks
const processRawBlocks = (rawBlocks: string[]): Chunk[] => {
  return rawBlocks
    .filter((block) => block.trim().length > 0) // Remove empty blocks
    .map((block) => {
      const trimmedBlock = block.trim();

      // Check for headings (# Heading)
      if (/^#{1,6}\s+.+/.test(trimmedBlock)) {
        const headingLevel =
          trimmedBlock.match(/^(#{1,6})\s+/)?.[1].length || 1;
        return {
          content: trimmedBlock.replace(/^#{1,6}\s+/, ''),
          type: 'heading',
          metadata: { headingLevel },
        };
      }

      // Check for code blocks
      if (trimmedBlock.startsWith('```')) {
        const codeLanguage =
          trimmedBlock.match(/^```([a-zA-Z0-9]+)?/)?.[1] || '';
        const content = trimmedBlock
          .replace(/^```[a-zA-Z0-9]*\n/, '')
          .replace(/```$/, '');

        return {
          content,
          type: 'code',
          metadata: { codeLanguage },
        };
      }

      // Check for lists
      if (
        /^[-*+]\s+.+/.test(trimmedBlock) ||
        /^\d+\.\s+.+/.test(trimmedBlock)
      ) {
        return {
          content: trimmedBlock,
          type: 'list',
        };
      }

      // Default to paragraph
      return {
        content: trimmedBlock,
        type: 'paragraph',
      };
    });
};

/**
 * This function should take a list of predictions and a shape
 * and output a list of shapes and bindings to create.
 */
const getPredictionShapes = (predictions: string[], shape: LinkShape) => {
  const predictionShapes: (PredictionShape | TLArrowShape)[] = [];
  const predictionBindings: TLArrowBinding[] = [];

  const parentX = shape.x;
  const parentY = shape.y;
  const parentHeight = shape.props.h;
  const parentWidth = shape.props.w;

  for (const prediction of predictions) {
    const { height: predictionHeight, width: predictionWidth } =
      calculatePredictionSize(prediction);

    const childX = parentX + predictionWidth / 2 + Math.random() * 100 - 50;
    const childY = parentY + predictionHeight / 2 + Math.random() * 100 - 50;

    const arrowX = (parentX + childX) / 2;
    const arrowY = (parentY + childY) / 2;

    const predictionId = generateTlShapeId('prediction');
    const arrowId = generateTlShapeId('arrow');

    const predArrow: TLArrowShape = {
      id: arrowId,
      type: 'arrow',
      x: arrowX,
      y: arrowY,
      props: {
        dash: 'draw',
        size: 'm',
        fill: 'none',
        color: 'black',
        labelColor: 'black',
        bend: 0,
        start: { x: parentX - arrowX, y: parentY - arrowY },
        end: { x: childX - arrowX, y: childY - arrowY },
        arrowheadStart: 'none',
        arrowheadEnd: 'arrow',
        text: '',
        labelPosition: 0.5,
        font: 'draw',
        scale: 1,
      },
      parentId: shape.parentId,
      index: 'a0' as IndexKey,
      typeName: 'shape',
      rotation: 0,
      isLocked: false,
      opacity: 1,
      meta: {},
    };

    // add the two bindings
    const binding1: TLArrowBinding = {
      id: generateTlBindingId(),
      typeName: 'binding',
      type: 'arrow',
      fromId: arrowId,
      toId: shape.id,
      props: {
        isPrecise: false,
        isExact: false,
        normalizedAnchor: { x: 0.5, y: 0.5 },
        terminal: 'start',
      },
      meta: {},
    };

    const binding2: TLArrowBinding = {
      id: generateTlBindingId(),
      type: 'arrow',
      fromId: arrowId,
      toId: predictionId,
      props: {
        isPrecise: false,
        isExact: false,
        normalizedAnchor: { x: 0.5, y: 0.5 },
        terminal: 'end',
      },
      meta: {},
      typeName: 'binding',
    };

    const predictionShape: PredictionShape = {
      id: predictionId,
      type: 'prediction',
      x: childX,
      y: childY,
      props: {
        h: predictionHeight,
        w: predictionWidth,
        text: prediction,
        parentId: shape.id,
        arrowId: arrowId,
      },
      parentId: shape.parentId,
      index: 'a0' as IndexKey,
      typeName: 'shape',
      rotation: 0,
      isLocked: false,
      opacity: 1,
      meta: {},
    };

    predictionShapes.push(predictionShape, predArrow);
    predictionBindings.push(binding1, binding2);
  }

  return { shapes: predictionShapes, bindings: predictionBindings };
};

const calculatePredictionSize = (text: string) => {
  const MIN_HEIGHT = 200;
  const MIN_WIDTH = 300;
  const CHARS_PER_LINE = 50;
  const HEIGHT_PER_LINE = 75;

  const textLength = text.length;
  const widthScale = Math.min(2, 1 + textLength / 500); // Cap at 2x original width
  const width = Math.ceil(MIN_WIDTH * widthScale);

  const charsPerWidthAdjustedLine = CHARS_PER_LINE * (width / MIN_WIDTH);
  const numLines = Math.ceil(textLength / charsPerWidthAdjustedLine);
  const height = Math.max(numLines * HEIGHT_PER_LINE, MIN_HEIGHT);

  const padding = 25;

  return {
    height: height + padding,
    width: width + padding,
  };
};
