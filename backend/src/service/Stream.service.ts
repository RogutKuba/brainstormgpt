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
  streamedNodeSchema = z
    .object({
      text: z.string(),
      parentId: z.string().nullable(),
      predictions: z.array(z.string()),
    })
    .partial();

  nodeMessageSchema = z.object({
    id: z.string(),
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
            pendingPredictions.forEach(({ predId, predChunk }) => {
              const predChunkToSend: z.infer<
                typeof this.predictionMessageSchema
              > = {
                id: predId,
                chunk: predChunk,
                parentId: id,
              };

              this.streamController.enqueue(
                this.encoder.encode(
                  `event: prediction-chunk\ndata: ${JSON.stringify(
                    predChunkToSend
                  )}\n\n`
                )
              );
            });

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
    workspaceId: string;
    ctx: Context<AppContext>;
  }) => {
    const { shapes, bindings, workspaceId, searchType, ctx, context } = params;

    // in this case, we add the nodes to the editor if they dont already exist, to make sure the writes are durable in
    // case client disconnects before the nodes are fully streamed.

    const id = ctx.env.TLDRAW_DURABLE_OBJECT.idFromName(workspaceId);
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
        workspaceId,
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
    answer?: string;
    predictions?: Array<{ text: string; type: 'text' | 'web' | 'image' }>;
  } {
    const result: {
      explanation?: string;
      answer?: string;
      predictions?: Array<{ text: string; type: 'text' | 'web' | 'image' }>;
    } = {};

    // Extract explanation - handle both complete and partial tags
    const explanationMatch = content.match(
      /<explanation>(.*?)(?:<\/explanation>|$)/s
    );
    if (explanationMatch && explanationMatch[1]) {
      result.explanation = explanationMatch[1].trim();
    }

    // Extract answer - handle both complete and partial tags
    const answerMatch = content.match(/<node>(.*?)(?:<\/node>|$)/s);
    if (answerMatch && answerMatch[1]) {
      result.answer = answerMatch[1].trim();
    } else if (!content.includes('<node>')) {
      // If no answer tags at all, use the whole content as the answer
      // But exclude any explanation or predictions sections
      let fullContent = content;

      // Remove explanation section if it exists
      if (content.includes('<explanation>')) {
        const explanationEndIndex = content.includes('</explanation>')
          ? content.indexOf('</explanation>') + 14
          : content.indexOf('<explanation>') +
            (explanationMatch?.[0].length ?? 0);

        fullContent = fullContent.substring(explanationEndIndex).trim();
      }

      // Remove predictions section if it exists
      if (fullContent.includes('<predictions>')) {
        fullContent = fullContent
          .substring(0, fullContent.indexOf('<predictions>'))
          .trim();
      }

      if (fullContent) {
        result.answer = fullContent;
      }
    }

    // Extract predictions - handle both complete and partial tags
    const predictionsMatch = content.match(
      /<predictions>(.*?)(?:<\/predictions>|$)/s
    );
    if (predictionsMatch && predictionsMatch[1]) {
      const predictionsContent = predictionsMatch[1].trim();

      // Look for prediction items (lines starting with -)
      const predictionLines = predictionsContent
        .split('\n')
        .filter((line) => line.trim().startsWith('-'))
        .map((line) => line.trim().substring(1).trim());

      if (predictionLines.length > 0) {
        result.predictions = predictionLines.map((line) => {
          // Parse the prediction format: "text|type"
          const parts = line.split('|');
          const predictionText = parts[0].trim();
          const predictionType = (parts[1]?.trim() || 'text') as
            | 'text'
            | 'web'
            | 'image';

          return {
            text: predictionText,
            type: predictionType,
          };
        });
      }
    }

    return result;
  }

  public getPrevNodeInfo(index: number) {
    return this.prevNodeInfo.get(index);
  }
}
