import { ReadableStreamController } from 'stream/web';
import { TLArrowBinding, TLArrowShape, TLShapeId } from 'tldraw';
import { z } from 'zod';
import { generateTlShapeId } from '../lib/id';
import { brainstormStreamSchema } from './Brainstorm.service';
import { Context } from 'hono';
import { AppContext } from '..';
import { LinkShape } from '../shapes/Link.shape';
import { RichTextShape } from '../shapes/RichText.shape';
import { CrawlerService } from './Crawler.service';

export class StreamService {
  // SCHEMAS
  nodeMessageSchema = z.object({
    id: z.string(),
    title: z.string(),
    chunk: z.string(),
    parentId: z.string().nullable(),
    predictions: z.array(
      z.object({
        text: z.string(),
        type: z.enum(['text', 'image', 'web']),
      })
    ),
  });

  predictionMessageSchema = z.object({
    id: z.string(),
    chunk: z.string(),
    parentId: z.string().nullable(),
    type: z.enum(['text', 'image', 'web']),
    index: z.number(),
  });

  // PRIVATE PROPERTIES

  public streamController: ReadableStreamController<any>;
  private encoder: TextEncoder;

  /**
   * The previous explanation length
   */
  private prevExplanationLength = 0;

  /**
   * The previous sent node info map
   */
  private prevNodeInfo: Map<
    number,
    {
      id: TLShapeId;
      textLength: number;
      prevPredictions: Map<
        number,
        {
          id: string;
          length: number;
        }
      >;
      // Queue of pending prediction chunks to send after node is established
      pendingPredictions: Array<{
        predIndex: number;
        predId: string;
        predChunk: string;
        predType: 'text' | 'web' | 'image';
      }>;
    }
  > = new Map();

  constructor(streamController: ReadableStreamController<any>) {
    this.streamController = streamController;
    this.encoder = new TextEncoder();
  }

  /**
   * Handles the explanation streaming
   * @param explanation - The explanation to be streamed
   */
  public handleExplanation = async (explanation: string | undefined) => {
    if (explanation && explanation.length > this.prevExplanationLength) {
      const newChunk = explanation.substring(this.prevExplanationLength);

      this.streamController.enqueue(
        this.encoder.encode(`event: message-chunk\ndata: ${newChunk}\n\n`)
      );

      this.prevExplanationLength = explanation.length;
    }
  };

  /**
   * Handle the nodes streaming
   * @param nodes - The nodes to be streamed
   */
  public handleNodes = async (
    nodes: z.infer<typeof brainstormStreamSchema>['nodes'] | undefined
  ) => {
    if (!nodes) return;

    nodes.forEach((node, index) => {
      const prevNodeInfo = this.prevNodeInfo.get(index);

      const id = prevNodeInfo?.id ?? generateTlShapeId();

      const predictionMap =
        prevNodeInfo?.prevPredictions ??
        new Map<
          number,
          {
            id: string;
            length: number;
          }
        >();

      // Initialize or get the pending predictions queue
      const pendingPredictions = prevNodeInfo?.pendingPredictions ?? [];

      const prevTextLength = prevNodeInfo?.textLength ?? 0;

      // decide to stream new text chunk for node content
      if (node.text?.length && node.text?.length > prevTextLength) {
        const chunk = node.text?.substring(prevTextLength) ?? '';

        if (chunk.length > 0) {
          const toSend: z.infer<typeof this.nodeMessageSchema> = {
            id,
            title: node.title ?? '',
            chunk,
            parentId: node.parentId ?? null,
            predictions: node.predictions ?? [],
          };

          this.streamController.enqueue(
            this.encoder.encode(
              `event: node-chunk\ndata: ${JSON.stringify(toSend)}\n\n`
            )
          );

          // Process any pending predictions immediately after sending a node chunk
          if (pendingPredictions.length > 0) {
            pendingPredictions.forEach(
              ({ predId, predChunk, predType }, index) => {
                const predChunkToSend: z.infer<
                  typeof this.predictionMessageSchema
                > = {
                  id: predId,
                  chunk: predChunk,
                  parentId: id,
                  type: predType,
                  index,
                };

                this.streamController.enqueue(
                  this.encoder.encode(
                    `event: prediction-chunk\ndata: ${JSON.stringify(
                      predChunkToSend
                    )}\n\n`
                  )
                );
              }
            );

            // Clear the pending predictions after sending them
            pendingPredictions.length = 0;
          }
        }
      }

      this.prevNodeInfo.set(index, {
        id,
        textLength: node.text?.length ?? 0,
        prevPredictions: predictionMap,
        pendingPredictions,
      });
    });
  };

  /**
   * Handle completed node shapes
   * @param shapes - The shapes to be handled
   */
  public handleCompletedNodeShapes = async (params: {
    shapes: (LinkShape | RichTextShape | TLArrowShape)[];
    context: string;
    bindings: TLArrowBinding[];
    searchType: 'text' | 'web' | 'image';
    workspaceCode: string;
    ctx: Context<AppContext>;
  }) => {
    const { shapes, bindings, workspaceCode, searchType, ctx, context } =
      params;

    // in this case, we add the nodes to the editor if they dont already exist, to make sure the writes are durable in
    // case client disconnects before the nodes are fully streamed.

    const id = ctx.env.TLDRAW_DURABLE_OBJECT.idFromName(workspaceCode);
    const workspace = ctx.env.TLDRAW_DURABLE_OBJECT.get(id);

    if (searchType === 'text') {
      await workspace.updateShapes(shapes, {
        // TODO: fix this so that we actually create the shapes if they don't exist
        createIfMissing: false,
        additionalRecords: bindings,
        keysToMerge: {
          shape: [''],
          props: ['text', 'predictions'],
        },
      });
    } else if (searchType === 'web' || searchType === 'image') {
      // TODO: fix this so that we actually upsert all shapes instead of just creating links
      const nonTextShapes = shapes.filter(
        (shape) => shape.type !== 'rich-text'
      ) as (LinkShape | RichTextShape)[];

      await workspace.addRecords([...nonTextShapes, ...bindings]);

      // now start crawling service for all the newly added link shapes
      const linkShapes = nonTextShapes.filter(
        (shape) => shape.type === 'link'
      ) as LinkShape[];

      const crawlerService = new CrawlerService({
        workspaceCode,
        ctx,
      });

      // this we can do in waitUntil as it will run in the backgrond
      ctx.executionCtx.waitUntil(
        crawlerService.updateLinkShapes({
          shapes: linkShapes.map((shape) => ({
            shapeId: shape.id,
            url: shape.props.url,
          })),
          context,
          ctx,
        })
      );
    } else {
      throw new Error('Invalid search type');
    }
  };

  public handleWebSearchContent = async (params: {
    answerContent: string;
    parentId: TLShapeId;
  }) => {
    const { answerContent, parentId } = params;
    const MAIN_NODE_INDEX = 0;

    const prevNodeInfo = this.getPrevNodeInfo(MAIN_NODE_INDEX);

    // Get shape id or generate new one
    const id = prevNodeInfo?.id ?? generateTlShapeId();
    const prevTextLength = prevNodeInfo?.textLength ?? 0;

    // Initialize or get the prediction map
    const predictionMap = prevNodeInfo?.prevPredictions ?? new Map();
    const pendingPredictions = prevNodeInfo?.pendingPredictions ?? [];

    // Parse the content to extract explanation, answer, and predictions
    const parsedContent = this.parseWebSearchContent(answerContent);

    // Handle the main answer content
    if (parsedContent.answer && parsedContent.answer.length > prevTextLength) {
      const chunk = parsedContent.answer.substring(prevTextLength);

      if (chunk.length > 0) {
        const toSend: z.infer<typeof this.nodeMessageSchema> = {
          id,
          title: parsedContent.title ?? '',
          chunk,
          parentId,
          predictions: parsedContent.predictions || [],
        };

        this.streamController.enqueue(
          this.encoder.encode(
            `event: node-chunk\ndata: ${JSON.stringify(toSend)}\n\n`
          )
        );
      }
    }

    // Handle explanation separately if needed
    if (
      parsedContent.explanation &&
      parsedContent.explanation.length !== this.prevExplanationLength
    ) {
      this.handleExplanation(parsedContent.explanation);
    }

    // Handle predictions - send any new predictions that weren't sent before
    if (parsedContent.predictions && parsedContent.predictions.length > 0) {
      parsedContent.predictions.forEach((prediction, index) => {
        const prevPrediction = predictionMap.get(index);

        // If this prediction doesn't exist yet or has changed
        if (!prevPrediction || prevPrediction.length < prediction.text.length) {
          const predId = prevPrediction?.id ?? generateTlShapeId();
          const prevLength = prevPrediction?.length ?? 0;
          const predChunk = prediction.text.substring(prevLength);

          if (predChunk.length > 0) {
            // If the main node is established, send the prediction immediately
            if (prevTextLength > 0) {
              const predChunkToSend: z.infer<
                typeof this.predictionMessageSchema
              > = {
                id: predId,
                chunk: predChunk,
                parentId: id,
                type: prediction.type,
                index,
              };

              this.streamController.enqueue(
                this.encoder.encode(
                  `event: prediction-chunk\ndata: ${JSON.stringify(
                    predChunkToSend
                  )}\n\n`
                )
              );
            } else {
              // Otherwise, queue it to be sent after the node is established
              pendingPredictions.push({
                predIndex: index,
                predId,
                predChunk,
                predType: prediction.type,
              });
            }
          }

          // Update the prediction map
          predictionMap.set(index, {
            id: predId,
            length: prediction.text.length,
          });
        }
      });
    }

    // Update the node info
    this.prevNodeInfo.set(MAIN_NODE_INDEX, {
      id,
      textLength: parsedContent.answer?.length ?? 0,
      prevPredictions: predictionMap,
      pendingPredictions,
    });
  };

  /**
   * Parses web search content to extract explanation, answer, and predictions
   * Handles partial tags and streaming content
   */
  private parseWebSearchContent(content: string): {
    explanation?: string;
    title?: string;
    answer?: string;
    predictions?: Array<{ text: string; type: 'text' | 'web' | 'image' }>;
  } {
    const result: {
      explanation?: string;
      title?: string;
      answer?: string;
      predictions?: Array<{ text: string; type: 'text' | 'web' | 'image' }>;
    } = {};

    // Extract explanation - handle both complete and partial tags
    if (content.includes('<explanation>')) {
      // Try to get content between complete tags first
      const completeExplanationRegex = /<explanation>([\s\S]*?)<\/explanation>/;
      const completeMatch = content.match(completeExplanationRegex);

      if (completeMatch && completeMatch[1]) {
        result.explanation = completeMatch[1].trim();
      } else {
        // Handle partial/incomplete explanation tag
        const partialExplanationRegex = /<explanation>([\s\S]*)$/;
        const partialMatch = content.match(partialExplanationRegex);

        if (partialMatch && partialMatch[1]) {
          // Clean up the explanation - remove any trailing partial tags
          let explanation = partialMatch[1].trim();
          // Remove any trailing partial XML tags that might be present
          explanation = explanation.replace(/<[^>]*$/, '');
          result.explanation = explanation;
        }
      }
    }

    // Extract title if present
    const titleRegex = /<title>([\s\S]*?)(?:<\/title>|$)/;
    const titleMatch = content.match(titleRegex);
    if (titleMatch && titleMatch[1]) {
      result.title = titleMatch[1].trim();
    }

    // Extract answer from node tag - handle both complete and partial tags
    if (content.includes('<node>')) {
      // Try complete node tags first
      const completeNodeRegex = /<node>([\s\S]*?)<\/node>/;
      const completeMatch = content.match(completeNodeRegex);

      if (completeMatch && completeMatch[1]) {
        result.answer = completeMatch[1].trim();
      } else {
        // Handle partial/incomplete node tag
        const partialNodeRegex = /<node>([\s\S]*)$/;
        const partialMatch = content.match(partialNodeRegex);

        if (partialMatch && partialMatch[1]) {
          // Clean up the answer - remove any trailing partial tags
          let answer = partialMatch[1].trim();
          // Remove any trailing partial XML tags that might be present
          answer = answer.replace(/<[^>]*$/, '');
          result.answer = answer;
        }
      }
    }

    // Extract predictions - look for specific format in the content
    // This handles both structured predictions and unstructured text that looks like predictions
    const predictions: Array<{ text: string; type: 'text' | 'web' | 'image' }> =
      [];

    // Try to extract predictions from prediction tags first
    const predictionTagsRegex = /<predictions>([\s\S]*?)(?:<\/predictions>|$)/;
    const predTagsMatch = content.match(predictionTagsRegex);

    if (predTagsMatch && predTagsMatch[1]) {
      // Parse structured predictions inside the predictions tag
      const predLines = predTagsMatch[1]
        .split('\n')
        .filter((line) => line.trim());

      for (const line of predLines) {
        // Look for format like: - type|text
        const predMatch = line.match(/^\s*-\s*((?:text|web|image)\|.+)$/);
        if (predMatch && predMatch[1]) {
          const parts = predMatch[1].split('|');
          if (parts.length >= 2) {
            const predType = parts[0].trim() as 'text' | 'web' | 'image';
            const predText = parts.slice(1).join('|').trim(); // Join in case there are | in the text

            if (predText) {
              predictions.push({ text: predText, type: predType });
            }
          }
        }
      }
    }

    // Also look for predictions in the general content (outside of tags)
    const predictionRegex = /(?:^|\n)-\s*((?:text|web|image)\|.+?)(?:\n|$)/g;
    let match;

    while ((match = predictionRegex.exec(content)) !== null) {
      const predLine = match[1].trim();
      const parts = predLine.split('|');

      if (parts.length >= 2) {
        const predType = parts[0].trim() as 'text' | 'web' | 'image';
        const predText = parts.slice(1).join('|').trim();

        if (predText) {
          // Check if this prediction is already added
          const isDuplicate = predictions.some(
            (p) => p.type === predType && p.text === predText
          );

          if (!isDuplicate) {
            predictions.push({ text: predText, type: predType });
          }
        }
      }
    }

    if (predictions.length > 0) {
      result.predictions = predictions;
    }

    return result;
  }

  public getPrevNodeInfo(index: number) {
    return this.prevNodeInfo.get(index);
  }
}
