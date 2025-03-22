import { ReadableStreamController } from 'stream/web';
import { TLShapeId } from 'tldraw';
import { z } from 'zod';
import { generateTlShapeId } from '../lib/id';
import { brainstormStreamSchema } from './Brainstorm.service';

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
  });

  predictionMessageSchema = z.object({
    id: z.string(),
    chunk: z.string(),
    parentId: z.string().nullable(),
  });

  deletePredictionMessageSchema = z.object({
    id: z.string(),
  });

  // PRIVATE PROPERTIES

  private streamController: ReadableStreamController<any>;
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
    nodes: z.infer<typeof brainstormStreamSchema>['nodes'] | undefined,
    existingPredictionId: string | null
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
      let nodeChunkSent = false;

      // decide to stream new text chunk for node content
      if (node.text?.length && node.text?.length > prevTextLength) {
        const chunk = node.text?.substring(prevTextLength) ?? '';

        if (chunk.length > 0) {
          this.handlePredictionDeletion(existingPredictionId);

          const toSend: z.infer<typeof this.nodeMessageSchema> = {
            id,
            chunk,
            parentId: node.parentId ?? null,
          };

          this.streamController.enqueue(
            this.encoder.encode(
              `event: node-chunk\ndata: ${JSON.stringify(toSend)}\n\n`
            )
          );

          nodeChunkSent = true;

          // Process any pending predictions immediately after sending a node chunk
          if (pendingPredictions.length > 0) {
            console.log(
              `Processing ${pendingPredictions.length} pending predictions for node ${id}`
            );

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

      // handle predictions in same way as nodes, but queue them if node is new
      node.predictions?.forEach((prediction, predIndex) => {
        const prevPred = prevNodeInfo?.prevPredictions?.get(predIndex);

        const predId = prevPred?.id ?? generateTlShapeId();

        const predChunk = prediction.substring(prevPred?.length ?? 0);

        if (predChunk.length > 0) {
          // Create prediction chunk to send
          const predChunkToSend: z.infer<typeof this.predictionMessageSchema> =
            {
              id: predId,
              chunk: predChunk,
              parentId: id,
            };

          // If this is a new node (no previous text) or we just sent a node chunk,
          // we can send the prediction chunk immediately
          if (prevTextLength > 0 || nodeChunkSent) {
            this.streamController.enqueue(
              this.encoder.encode(
                `event: prediction-chunk\ndata: ${JSON.stringify(
                  predChunkToSend
                )}\n\n`
              )
            );
          } else {
            // Otherwise, queue the prediction to be sent after the node is established
            pendingPredictions.push({
              predIndex,
              predId,
              predChunk,
            });
          }
        }

        // update prediction map
        predictionMap.set(predIndex, {
          id: predId,
          length: prediction.length,
        });
      });

      this.prevNodeInfo.set(index, {
        id,
        textLength: node.text?.length ?? 0,
        prevPredictions: predictionMap,
        pendingPredictions,
      });
    });
  };

  /**
   * Handles the deletion of an existing prediction
   */
  private handlePredictionDeletion = (predictionId: string | null) => {
    if (!predictionId || this.deletedPastPrediction) return;
    // send event to delete prediction
    const toSend: z.infer<typeof this.deletePredictionMessageSchema> = {
      id: predictionId,
    };

    this.streamController.enqueue(
      this.encoder.encode(
        `event: delete-prediction\ndata: ${JSON.stringify(toSend)}\n\n`
      )
    );

    this.deletedPastPrediction = true;
  };
}
