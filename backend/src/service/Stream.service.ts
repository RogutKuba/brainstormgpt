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

      // node.predictions?.forEach((prediction, predIndex) => {
      //   const prevPred = prevNodeInfo?.prevPredictions?.get(predIndex);

      //   const predId = prevPred?.id ?? generateTlShapeId();
      //   const predictionLength = prediction.length;
      // });

      const prevTextLength = prevNodeInfo?.textLength ?? 0;

      // decide to stream new text chunk for node content
      if (node.text?.length && node.text?.length > prevTextLength) {
        const chunk = node.text?.substring(prevTextLength) ?? '';

        const toSend: z.infer<typeof this.nodeMessageSchema> = {
          id,
          chunk,
          parentId: node.parentId ?? null,
        };

        console.log('sending-node-chunk', toSend);

        this.streamController.enqueue(
          this.encoder.encode(
            `event: node-chunk\ndata: ${JSON.stringify(toSend)}\n\n`
          )
        );
      }

      this.prevNodeInfo.set(index, {
        id,
        textLength: node.text?.length ?? 0,
        prevPredictions: predictionMap,
      });
    });
  };
}
