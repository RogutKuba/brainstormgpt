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

// make sure our sync durable object is made available to cloudflare
export { TldrawDurableObject } from './TldrawDurableObject';

export type AppContext = {
  Bindings: {
    TLDRAW_BUCKET: R2Bucket;
    TLDRAW_DURABLE_OBJECT: DurableObjectNamespace;

    // API KEYS
    OPENAI_API_KEY: string;

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

// requests to /connect are routed to the Durable Object, and handle realtime websocket syncing
app.get('/connect/:roomId', async (ctx) => {
  const roomId = ctx.req.param('roomId');
  const id = ctx.env.TLDRAW_DURABLE_OBJECT.idFromName(roomId);
  const room = ctx.env.TLDRAW_DURABLE_OBJECT.get(id);

  return room.fetch(ctx.req.url, {
    headers: ctx.req.raw.headers,
    body: ctx.req.raw.body,
  });
});

// Add CORS middleware
app
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
  .route('/auth', authRouter)
  .route('/auth/google', googleAuthRouter)
  .use(authMiddleware)
  .route('/workspace', workspaceRouter)
  .post('/uploads/:uploadId', async (ctx) => {
    const result = await handleAssetUpload(ctx);
    return ctx.json(result, 200);
  })
  .get('/uploads/:uploadId', async (ctx) => {
    const result = await handleAssetDownload(ctx);
    return ctx.json(result, 200);
  })
  .post('/brainstorm/:roomId', async (ctx) => {
    const { prompt, shapes, goal } = await ctx.req.json();

    const result = await BrainstormService.generateBrainstorm({
      prompt,
      goal,
      shapes,
      ctx,
    });

    return ctx.json(result, 200);
  });

// export our app for cloudflare
export default app;
