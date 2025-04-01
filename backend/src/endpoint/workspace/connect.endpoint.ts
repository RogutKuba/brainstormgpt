import { AppContext } from '../..';
import { VisitedService } from '../../service/Visited.service';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { getSession } from '../../lib/session';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { getDbConnection, takeUnique } from '../../db/client';
import { workspaceTable } from '../../db/workspace.db';
import { SessionService } from '../../service/Session.service';

const connectAuthMiddleware = createMiddleware<AppContext>(
  async (ctx, next) => {
    const code = ctx.req.param('workspaceCode');
    if (!code) {
      throw new HTTPException(400, { message: 'Workspace code is required' });
    }

    const db = getDbConnection(ctx);

    // Find the workspace by code
    const workspace = await db
      .select()
      .from(workspaceTable)
      .where(eq(workspaceTable.code, code))
      .then(takeUnique);

    if (!workspace) {
      throw new HTTPException(404, { message: 'Workspace not found' });
    }

    // can return early if workspace is public or anonymous
    if (workspace.isPublic || workspace.isAnonymous) {
      return next();
    }

    await SessionService.authenticateSession(ctx);
    const { user } = getSession(ctx);
    if (!user) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    // ensure user owns the workspace
    if (workspace.ownerId !== user.id) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    return next();
  }
);

export const connectWorkspaceRouter = new Hono<AppContext>()
  .use('*', connectAuthMiddleware)
  .get('/', async (ctx) => {
    const code = ctx.req.param('workspaceCode');
    if (!code) {
      throw new HTTPException(400, { message: 'Workspace code is required' });
    }

    // // Record the visit for analytics
    // ctx.executionCtx.waitUntil(
    //   new VisitedService(ctx).handleVisitedWorkspace(ctx)
    // );

    // Connect to the durable object
    const id = ctx.env.TLDRAW_DURABLE_OBJECT.idFromName(code);
    const room = ctx.env.TLDRAW_DURABLE_OBJECT.get(id);

    return room.fetch(ctx.req.url, {
      headers: ctx.req.raw.headers,
      body: ctx.req.raw.body,
    });
  })
  // TODO: simplify this
  .get('/status', async (ctx) => {
    // this is just used to check auth since have to query this seaprately from the websocket endpoint
    return ctx.json({
      status: 'ok',
      error: null,
    });
  });
