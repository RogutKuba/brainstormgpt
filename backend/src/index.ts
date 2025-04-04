import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { googleAuthRouter } from './endpoint/oauth.endpoint';
import { UserEntity, SessionEntity } from './db/user.db';
import { authMiddleware } from './middleware/auth.middleware';
import { workspaceRouter } from './endpoint/workspace.endpoint';
import { authRouter } from './endpoint/auth.endpoint';
import { TldrawDurableObject } from './durable-object/TldrawDurableObject';
import { urlShapeRouter } from './endpoint/shape/urlShape.endpoint';
import { ChunkWorkflowParams } from './workflow/Chunk.workflow';
import { streamRouter } from './endpoint/stream.endpoint';
import { anonWorkspaceRouter } from './endpoint/workspace/anon.endpoint';
import {
  connectAuthRouter,
  connectWorkspaceRouter,
} from './endpoint/workspace/connect.endpoint';

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
  // this route not part of cors middleware sine websocket connection fails with cors middleware
  .route('/workspace/:workspaceCode/connect', connectWorkspaceRouter)
  .use(
    '*',
    cors({
      origin: ['http://localhost:3000', 'https://brainstorm.rogutkuba.com'],
      credentials: true,
    })
  )
  .get('/health', async (ctx) => {
    return ctx.text('ok');
  })
  // TODO: refactor to combine into one router for all this workspace stuff
  .route('/workspace/:workspaceCode/connect/status', connectAuthRouter)
  .route('/workspace/:workspaceCode/stream', streamRouter)
  .route('/workspace/:workspaceCode/shape/url', urlShapeRouter)
  .route('/workspace/anonymous', anonWorkspaceRouter)
  .route('/auth', authRouter)
  .route('/auth/google', googleAuthRouter)
  .use(authMiddleware)
  .route('/workspace', workspaceRouter);

// export our app for cloudflare
export default app;

// console.log('app', app.routes);
