import { getSession } from '../lib/session';

import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { AppContext } from '../index';
import { getDbConnection, takeUnique } from '../db/client';
import { workspaceTable } from '../db/workspace.db';
import { SessionService } from '../service/Session.service';
import { eq } from 'drizzle-orm';

export const workspaceAuthMiddleware = createMiddleware<AppContext>(
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
    } else {
      await SessionService.authenticateSession(ctx);
      const { user } = getSession(ctx);

      // ensure user owns the workspace
      if (workspace.ownerId !== user.id) {
        throw new HTTPException(401, {
          message: 'Unauthorized (user does not own workspace)',
        });
      }

      return next();
    }
  }
);
