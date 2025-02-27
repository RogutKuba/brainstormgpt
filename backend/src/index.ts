import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handleAssetDownload, handleAssetUpload } from './assetUploads';
import { Environment } from './types';
import { BrainstormService } from './service/Brainstorm.service';

// make sure our sync durable object is made available to cloudflare
export { TldrawDurableObject } from './TldrawDurableObject';

export type AppContext = {
  Bindings: Environment;
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
app.use(
  '*',
  cors({
    origin: '*',
    // Add other CORS options as needed
  })
);

// Error handling middleware
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message }, 500);
});

// health check
app.get('/health', async (ctx) => {
  return ctx.json({ ok: true });
});

// assets can be uploaded to the bucket under /uploads:
app.post('/uploads/:uploadId', async (ctx) => {
  const result = await handleAssetUpload(ctx);
  return ctx.json(result, 200);
});

// they can be retrieved from the bucket too:
app.get('/uploads/:uploadId', async (ctx) => {
  const result = await handleAssetDownload(ctx);
  return ctx.json(result, 200);
});

// make an ai route that takes in a prompt and then will make changes to the room
app.post('/brainstorm/:roomId', async (ctx) => {
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
