import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { UserEntity, SessionEntity } from './db/user.db';
import { authMiddleware } from './middleware/auth.middleware';
import { workspaceRouter } from './endpoint/workspace.endpoint';
import { authRouter } from './endpoint/auth.endpoint';
import { TldrawDurableObject } from './durable-object/TldrawDurableObject';
import { anonWorkspaceRouter } from './endpoint/workspace/anon.endpoint';
import { connectWorkspaceRouter } from './endpoint/workspace/connect.endpoint';
import { accountRouter } from './endpoint/account.endpoint';
import { stripeRouter } from './endpoint/webhook/stripe.endpoint';
import { workspaceActionsRouter } from './endpoint/workspace/actions.endpoint';
import { ChunkWorkflowParams } from './workflow/Chunk.workflow';

// export durable object and workflows
export { TldrawDurableObject } from './durable-object/TldrawDurableObject';
export { ChunkWorkflow } from './workflow/Chunk.workflow';

export type AppContext = {
  Bindings: {
    TLDRAW_BUCKET: R2Bucket;
    TLDRAW_DURABLE_OBJECT: DurableObjectNamespace<TldrawDurableObject>;
    HYPERDRIVE: Hyperdrive;

    // WORKFLOWS
    ChunkWorkflow: Workflow<ChunkWorkflowParams>;

    // API KEYS
    OPENROUTER_API_KEY: string;
    OPENAI_API_KEY: string;
    FIRECRAWL_API_KEY: string;

    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GOOGLE_REDIRECT_URI: string;

    // STRIPE
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    STRIPE_PRO_PLAN_ID: string;

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
  .get('/health', async (ctx) => {
    return ctx.text('ok');
  })
  // this route not part of cors middleware sine websocket connection fails with cors middleware
  .route('/workspace/:workspaceCode/connect', connectWorkspaceRouter)
  .route('/webhook/stripe', stripeRouter)
  .use(
    '*',
    cors({
      origin: ['http://localhost:3000', 'https://brainstorm.rogutkuba.com'],
      credentials: true,
    })
  )
  // separate routes for workspace actions since some actions can be taken without authentication
  .route('/workspace/:workspaceCode', workspaceActionsRouter)
  .route('/workspace/anonymous', anonWorkspaceRouter)
  .route('/auth', authRouter)
  .use(authMiddleware)
  .route('/account', accountRouter)
  .route('/workspace', workspaceRouter);

// export our app for cloudflare
export default app;

// console.log('app', app.routes);
