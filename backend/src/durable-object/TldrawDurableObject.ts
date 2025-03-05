import { RoomSnapshot, TLSocketRoom } from '@tldraw/sync-core';
import {
  TLRecord,
  TLShape,
  TLTextShape,
  createTLSchema,
  defaultShapeSchemas,
  TLBaseShape,
  TLDocument,
  TLParentId,
  TLShapeId,
} from '@tldraw/tlschema';
import { AutoRouter, IRequest, error } from 'itty-router';
import throttle from 'lodash.throttle';
import { Environment } from '../types';
import { DurableObject } from 'cloudflare:workers';
import { IndexKey, RecordId } from 'tldraw';
import { ShapeService } from '../service/Shape.service';

type LinkShapeProps = {
  url: string;
  text: string;
  w: number;
  h: number;
};

type LinkShape = TLBaseShape<'link', LinkShapeProps>;

// add custom shapes and bindings here if needed:
const schema = createTLSchema({
  shapes: {
    ...defaultShapeSchemas,
    // link: {
    //   props: LinkShape.
    // },
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
    })
    .post('/brainstorm/:workspaceId', async (request) => {
      if (!this.workspaceId) return error(400, 'Missing workspaceId');
      return this.handleBrainstorm(request);
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

  async handleBrainstorm(request: IRequest): Promise<Response> {
    const { prompt, shapes } = await request.json<{
      prompt: string;
      shapes: TLShape[];
    }>();
    // console.log('brainstorm', prompt, shapes);

    // I want to transform the shapes into a text prompt
    const shapeTexts = (() => {
      // collect all the text shapes
      const textShapes = shapes.filter(
        (shape) => shape.type === 'text'
      ) as TLTextShape[];

      return textShapes.map((shape) => shape.props.text?.trim() ?? '');
    })();

    const room = await this.getRoom();
    const snapshot = room.getCurrentSnapshot();

    const currentDocuments = snapshot.documents;

    // get only typeName = shape
    const currentShapes = currentDocuments.filter(
      (shape) => shape.state.typeName === 'shape'
    );

    console.log(currentShapes);

    // currentShapes.forEach((shape) => {
    //   console.dir(shape.state, { depth: null });
    //   console.log(shape.state.props);
    //   console.log('--------------------------------');
    // });

    // get some new shapes
    const shapeService = new ShapeService(snapshot);
    const newShapes = await shapeService.addBubbles([
      {
        text: prompt,
        parentId: null,
      },
      {
        text: "Hey this is a test. You're absolutely right. The current implementation doesn't account for newly added shapes when placing multiple bubbles, which could lead to overlaps. Let's fix that by updating the grid as we place each new shape.",
        parentId: null,
      },
      {
        text: 'Hey this is a test 2',
        parentId: null,
      },
      {
        text: 'Hey this is a test 3',
        parentId: null,
      },
    ]);

    console.log('newShapes', newShapes);

    room.updateStore((store) => {
      newShapes.forEach((shape) => {
        store.put(shape);
      });
    });

    // console.log('snapshot', snapshot.documents);

    return new Response(JSON.stringify([]));
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

  async addShape(shape: TLShape) {
    const room = await this.getRoom();
    room.updateStore((store) => {
      store.put(shape);
    });
  }

  async updateShape(shape: TLShape) {
    const room = await this.getRoom();
    room.updateStore((store) => {
      store.put(shape);
    });
  }

  async removeShape(shape: TLShape) {
    const room = await this.getRoom();
    room.updateStore((store) => {
      store.delete(shape.id);
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
}
