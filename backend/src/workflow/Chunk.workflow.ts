import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep,
} from 'cloudflare:workers';
import { AppContext } from '..';
import { getDbConnectionFromEnv, takeUnique } from '../db/client';
import { crawledPageTable } from '../db/crawledPage.db';
import { and, eq } from 'drizzle-orm';
import { NonRetryableError } from 'cloudflare:workflows';
import { PageChunkEntity, pageChunkTable } from '../db/pageChunk.db';
import { generateId } from '../lib/id';
import { SummaryService } from '../service/Summary.service';

export type ChunkWorkflowParams = {
  crawledPageId: string;
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
    const { crawledPageId } = event.payload;

    const crawledPage = await step.do('get-crawled-page', async () => {
      const db = getDbConnectionFromEnv(this.env);
      const crawledPage = await db
        .select({
          id: crawledPageTable.id,
          url: crawledPageTable.url,
          title: crawledPageTable.title,
          description: crawledPageTable.description,
          markdown: crawledPageTable.markdown,
          html: crawledPageTable.html,
          workspaceId: crawledPageTable.workspaceId,
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
    });

    if (!crawledPage) {
      throw new NonRetryableError(
        `Crawled page ${crawledPageId} not found or was not successful`
      );
    }

    await step.do('convert-content-to-chunks', async () => {
      const db = getDbConnectionFromEnv(this.env);

      // convert the markdown to chunks
      const chunks = await convertMarkdownToChunks(crawledPage.markdown);

      // insert the chunks into the database
      const chunkEntities: PageChunkEntity[] = chunks.map((chunk, index) => ({
        id: generateId('pageChunk'),
        createdAt: new Date().toISOString(),
        workspaceId: crawledPage.workspaceId,
        url: crawledPage.url,
        content: chunk.content,
        type: chunk.type,
        index,
      }));

      await db.insert(pageChunkTable).values(chunkEntities);

      return chunkEntities;
    });

    // create the page summary
    await step.do('create-page-summary', async () => {
      await SummaryService.createPageSummary({
        crawledPageId: crawledPage.id,
        env: this.env,
      });
    });
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
