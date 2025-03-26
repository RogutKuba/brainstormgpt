import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleAssetDownload, handleAssetUpload } from './assetUploads';
import { BrainstormService } from './service/Brainstorm.service';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { googleAuthRouter } from './endpoint/oauth.endpoint';
import { UserEntity, SessionEntity } from './db/user.db';
import { authMiddleware } from './middleware/auth.middleware';
import { workspaceRouter } from './endpoint/workspace.endpoint';
import { authRouter } from './endpoint/auth.endpoint';
import { VisitedService } from './service/Visited.service';
import { TldrawDurableObject } from './durable-object/TldrawDurableObject';
import { chatRouter } from './endpoint/chat.endpoint';
import { urlShapeRouter } from './endpoint/shape/urlShape.endpoint';
import { ChunkWorkflowParams } from './workflow/Chunk.workflow';
import { streamRouter } from './endpoint/stream.endpoint';
import { LLMService } from './service/LLM.service';

// export durable object and workflows
export { TldrawDurableObject } from './durable-object/TldrawDurableObject';
export { ChunkWorkflow } from './workflow/Chunk.workflow';

export type AppContext = {
  Bindings: {
    TLDRAW_BUCKET: R2Bucket;
    TLDRAW_DURABLE_OBJECT: DurableObjectNamespace<TldrawDurableObject>;

    // WORKFLOWS
    ChunkWorkflow: Workflow<ChunkWorkflowParams>;

    // API KEYS
    OPENROUTER_API_KEY: string;
    OPENAI_API_KEY: string;
    FIRECRAWL_API_KEY: string;

    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GOOGLE_REDIRECT_URI: string;

    DATABASE_URL: string;
    WEB_APP_URL: string;

    NODE_ENV: 'development' | 'production';
  };
  Variables: {
    db: PostgresJsDatabase;

    // session
    session: SessionEntity;
    user: UserEntity;
  };
};

// Create a new Hono app
const app = new Hono<AppContext>();

// Add CORS middleware
app
  // THIS ROUTE DOESNT NEED AUTH OR CORS
  .get('/connect/:workspaceId', async (ctx) => {
    const workspaceId = ctx.req.param('workspaceId');

    // save visitor to db for some sort of user analytics
    ctx.executionCtx.waitUntil(
      new VisitedService(ctx).handleVisitedWorkspace(ctx)
    );

    const id = ctx.env.TLDRAW_DURABLE_OBJECT.idFromName(workspaceId);
    const room = ctx.env.TLDRAW_DURABLE_OBJECT.get(id);

    return room.fetch(ctx.req.url, {
      headers: ctx.req.raw.headers,
      body: ctx.req.raw.body,
    });
  })
  .post('/uploads/:uploadId', async (ctx) => {
    const result = await handleAssetUpload(ctx);
    return ctx.json(result, 200);
  })
  .get('/uploads/:uploadId', async (ctx) => {
    const result = await handleAssetDownload(ctx);
    return ctx.json(result, 200);
  })
  .use(
    '*',
    cors({
      origin: ['http://localhost:3000', 'https://brainstorm.rogutkuba.com'],
      credentials: true,
    })
  )
  .route('/workspace/:workspaceId/chat', chatRouter)
  .route('/workspace/:workspaceId/stream', streamRouter)
  .route('/workspace/:workspaceId/shape/url', urlShapeRouter)
  .get('/health', async (ctx) => {
    return ctx.text('ok');
  })
  .route('/auth', authRouter)
  .route('/auth/google', googleAuthRouter)
  .use(authMiddleware)
  .route('/workspace', workspaceRouter);

// export our app for cloudflare
export default app;
