import { ReadableStreamController } from 'stream/web';
import { TLArrowBinding, TLArrowShape, TLShapeId } from 'tldraw';
import { z } from 'zod';
import { generateTlShapeId } from '../lib/id';
import { brainstormStreamSchema } from './Brainstorm.service';
import { Context } from 'hono';
import { AppContext } from '..';
import { LinkShape } from '../shapes/Link.shape';
import { RichTextShape } from '../shapes/RichText.shape';

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

  /**
   * Tracks if we have deleted the existing prediction
   */
  private deletedPastPrediction: boolean = false;

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
    bindings: TLArrowBinding[];
    searchType: 'text' | 'web' | 'image';
    workspaceId: string;
    ctx: Context<AppContext>;
  }) => {
    const { shapes, bindings, workspaceId, searchType, ctx } = params;

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

    // get shape id or generate new one
    const id = prevNodeInfo?.id ?? generateTlShapeId();
    const prevTextLength = prevNodeInfo?.textLength ?? 0;

    const chunk = answerContent.substring(prevTextLength);

    if (chunk.length > 0) {
      const toSend: z.infer<typeof this.nodeMessageSchema> = {
        id,
        chunk,
        parentId,
        predictions: [],
      };

      this.streamController.enqueue(
        this.encoder.encode(
          `event: node-chunk\ndata: ${JSON.stringify(toSend)}\n\n`
        )
      );
    }

    this.prevNodeInfo.set(MAIN_NODE_INDEX, {
      id,
      textLength: answerContent.length,
      prevPredictions: new Map(),
      pendingPredictions: [],
    });
  };

  public getPrevNodeInfo(index: number) {
    return this.prevNodeInfo.get(index);
  }
}
