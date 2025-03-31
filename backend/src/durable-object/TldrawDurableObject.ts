import {
  RoomSnapshot,
  RoomStoreMethods,
  TLSocketRoom,
} from '@tldraw/sync-core';
import {
  TLRecord,
  TLShape,
  TLTextShape,
  createTLSchema,
  defaultShapeSchemas,
  TLBaseShape,
} from '@tldraw/tlschema';
import { AutoRouter, IRequest, error } from 'itty-router';
import throttle from 'lodash.throttle';
import { Environment } from '../types';
import { DurableObject } from 'cloudflare:workers';
import { ShapeService } from '../service/Shape.service';
import { PredictionShape } from '../shapes/Prediction.shape';

// add custom shapes and bindings here if needed:
const schema = createTLSchema({
  shapes: {
    ...defaultShapeSchemas,
    link: {},
    'rich-text': {},
    prediction: {},
  },
});

// there's only ever one durable object instance per room. it keeps all the room state in memory and
// handles websocket connections. periodically, it persists the room state to the R2 bucket.
export class TldrawDurableObject extends DurableObject<Environment> {
  private r2: R2Bucket;
  // the room ID will be missing while the room is being initialized
  private workspaceId: string | null = null;
  // when we load the room from the R2 bucket, we keep it here. it's a promise so we only ever
  // load it once.
  private roomPromise: Promise<TLSocketRoom<TLRecord, void>> | null = null;

  constructor(ctx: DurableObjectState, env: Environment) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;

    this.r2 = env.TLDRAW_BUCKET;

    ctx.blockConcurrencyWhile(async () => {
      this.workspaceId = ((await this.ctx.storage.get('workspaceId')) ??
        null) as string | null;
    });
  }

  public async init(params: { workspaceId: string }) {
    const { workspaceId } = params;
    this.workspaceId = workspaceId;
    await this.ctx.storage.put('workspaceId', workspaceId);
  }

  private readonly router = AutoRouter({
    catch: (e) => {
      console.log(e);
      return error(e);
    },
  })
    // when we get a connection request, we stash the room id if needed and handle the connection
    .get('/connect/:workspaceId', async (request) => {
      if (!this.workspaceId) {
        await this.ctx.blockConcurrencyWhile(async () => {
          await this.ctx.storage.put('workspaceId', request.params.workspaceId);
          this.workspaceId = request.params.workspaceId;
        });
      }
      return this.handleConnect(request);
    });

  // `fetch` is the entry point for all requests to the Durable Object
  fetch(request: Request): Response | Promise<Response> {
    return this.router.fetch(request);
  }

  // what happens when someone tries to connect to this room?
  async handleConnect(request: IRequest): Promise<Response> {
    // extract query params from request
    const sessionId = request.query.sessionId as string;
    if (!sessionId) return error(400, 'Missing sessionId');

    // Create the websocket pair for the client
    const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair();
    serverWebSocket.accept();

    // load the room, or retrieve it if it's already loaded
    const room = await this.getRoom();

    // connect the client to the room
    room.handleSocketConnect({ sessionId, socket: serverWebSocket });

    // return the websocket connection to the client
    return new Response(null, { status: 101, webSocket: clientWebSocket });
  }

  getRoom() {
    const workspaceId = this.workspaceId;
    if (!workspaceId) throw new Error('Missing workspaceId');

    if (!this.roomPromise) {
      this.roomPromise = (async () => {
        // fetch the room from R2
        const roomFromBucket = await this.r2.get(`rooms/${workspaceId}`);

        // if it doesn't exist, we'll just create a new empty room
        const initialSnapshot = roomFromBucket
          ? ((await roomFromBucket.json()) as RoomSnapshot)
          : undefined;

        // create a new TLSocketRoom. This handles all the sync protocol & websocket connections.
        // it's up to us to persist the room state to R2 when needed though.
        return new TLSocketRoom<TLRecord, void>({
          schema,
          initialSnapshot,
          onDataChange: () => {
            // and persist whenever the data in the room changes
            this.schedulePersistToR2();
          },
        });
      })();
    }

    return this.roomPromise;
  }

  async getState() {
    const room = await this.getRoom();
    return room.getCurrentSnapshot();
  }

  /**
   * Gets a shape from the store.
   * @param shapeId - The ID of the shape to get.
   * @returns The shape.
   */
  async getShape(shapeId: string) {
    const room = await this.getRoom();
    return room.getRecord(shapeId);
  }

  /**
   * Updates a shape in the store. If the shape doesn't exist, it will be not be created.
   * @param shape - The shape to update.
   */
  async updateShape(shape: TLShape) {
    const room = await this.getRoom();
    room.updateStore((store) => {
      const existingShape = store.get(shape.id);
      if (existingShape) {
        store.put(shape);
      }
    });
  }

  /**
   * Partial update a shape in the store. By default if the shape doesn't exist, it will be not be created.
   * @param shape - The shape to update.
   */
  async updateShapes(
    shapes: (Pick<TLShape, 'id'> & Partial<TLShape>)[],
    options?: {
      additionalRecords?: TLRecord[];
      createIfMissing?: boolean;
      keysToMerge?: {
        shape: string[];
        props: string[];
      };
    }
  ) {
    const room = await this.getRoom();
    room.updateStore((store) => {
      shapes.forEach((shape) => {
        const existingShape = store.get(shape.id) as TLShape;
        if (existingShape) {
          // if keysToMerge is provided, only select the keys that are in the array in the shape
          if (options?.keysToMerge) {
            const shapeValuesToMerge = options.keysToMerge.shape.reduce(
              (acc, key) => {
                if (key in shape && key !== 'props') {
                  // TODO: fix this
                  // @ts-ignore
                  acc[key] = shape[key];
                }
                return acc;
              },
              {} as Partial<Omit<TLShape, 'props'>>
            );

            const propValuesToMerge = options.keysToMerge.props.reduce(
              (acc, key) => {
                if (shape.props && key in shape.props) {
                  // TODO: fix this
                  // @ts-ignore
                  acc[key] = shape.props[key];
                }
                return acc;
              },
              {}
            );

            // merge the existing shape with the new shape
            store.put({
              ...existingShape,
              ...shapeValuesToMerge,
              props: {
                ...existingShape.props,
                ...propValuesToMerge,
              },
            });
          } else {
            // otherwise merge the whole existing shape with the new shape
            store.put({
              ...existingShape,
              ...shape,
              props: {
                ...existingShape.props,
                ...(shape.props ?? {}),
              },
            });
          }
        } else if (options?.createIfMissing && shape.type) {
          // TODO: add actual validation to ensure the type has all the required fields
          store.put(shape as TLRecord);
        }
      });

      if (options?.additionalRecords) {
        options.additionalRecords.forEach((record) => {
          store.put(record);
        });
      }
    });
  }

  /**
   * Removes a shape from the store.
   * @param shapeId - The ID of the shape to remove.
   */
  async removeShape(shapeId: string) {
    const room = await this.getRoom();
    room.updateStore((store) => {
      store.delete(shapeId);
    });
  }

  /**
   * Remove prediction and arrows from the store.
   * @param predictionId - The ID of the prediction to remove.
   */
  async removePrediction(predictionId: string) {
    const room = await this.getRoom();
    room.updateStore((store) => {
      const shape = store.get(predictionId) as PredictionShape;
      if (shape && shape.type === 'prediction' && shape.props.arrowId) {
        store.delete(predictionId);
        store.delete(shape.props.arrowId);
      }
    });
  }

  // we throttle persistance so it only happens every 10 seconds
  private schedulePersistToR2 = throttle(async () => {
    if (!this.roomPromise || !this.workspaceId) return;
    const room = await this.getRoom();

    // convert the room to JSON and upload it to R2
    const snapshot = JSON.stringify(room.getCurrentSnapshot());
    await this.r2.put(`rooms/${this.workspaceId}`, snapshot);
  }, 10_000);

  // EXTERNAL METHODS
  /**
   * Gets the current snapshot of the room.
   * @returns The current snapshot of the room.
   */
  async getCurrentSnapshot(): Promise<RoomSnapshot> {
    const room = await this.getRoom();
    return room.getCurrentSnapshot() as RoomSnapshot;
  }

  /**
   * Gets the current document clock of the room.
   * @returns The current document clock of the room.
   */
  async getCurrentDocumentClock(): Promise<number> {
    const room = await this.getRoom();
    return room.getCurrentDocumentClock();
  }

  /**
   * Adds records to the store.
   * @param records - The records to add.
   */
  async addRecords(records: TLRecord[]) {
    const room = await this.getRoom();
    room.updateStore((store) => {
      records.forEach((record) => {
        console.log('adding record', record);
        store.put(record);
      });
    });
  }
}
