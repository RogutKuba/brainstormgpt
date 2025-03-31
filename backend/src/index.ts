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
import { anonWorkspaceRouter } from './endpoint/workspace/anon.endpoint';
import { connectWorkspaceRouter } from './endpoint/workspace/connect.endpoint';

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
  .route('/workspace/:workspaceCode/connect', connectWorkspaceRouter)
  .use(
    '*',
    cors({
      origin: ['http://localhost:3000', 'https://brainstorm.rogutkuba.com'],
      credentials: true,
    })
  )
  // .post('/waitlist', async (ctx) => {
  //   const email = ctx.req.json().email;
  //   const waitlistService = new WaitlistService(ctx);
  //   await waitlistService.addEmail(email);
  //   return ctx.json({ message: 'Email added to waitlist' }, 200);
  // })
  .route('/workspace/:workspaceCode/chat', chatRouter)
  .route('/workspace/:workspaceCode/stream', streamRouter)
  .route('/workspace/:workspaceCode/shape/url', urlShapeRouter)
  .route('/workspace/anonymous', anonWorkspaceRouter)
  .get('/health', async (ctx) => {
    return ctx.text('ok');
  })
  .route('/auth', authRouter)
  .route('/auth/google', googleAuthRouter)
  .use(authMiddleware)
  .route('/workspace', workspaceRouter);

// export our app for cloudflare
export default app;
