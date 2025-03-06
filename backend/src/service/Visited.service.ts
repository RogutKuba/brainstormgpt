import { Context } from 'hono';
import { AppContext } from '..';
import { getDbConnection } from '../db/client';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { visitedWorkspaceTable } from '../db/visited.db';
import { getCookie } from 'hono/cookie';
import { SESSION_COOKIE_NAME, SessionService } from './Session.service';

const BROWSER_ID_COOKIE = 'browser_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year in seconds

export class VisitedService {
  private db: PostgresJsDatabase;

  constructor(ctx: Context<AppContext>) {
    this.db = getDbConnection(ctx);
  }

  async handleVisitedWorkspace(ctx: Context<AppContext>) {
    const browserId = this.getBrowserId(ctx);

    if (!browserId) {
      return;
    }

    const workspaceId = ctx.req.param('workspaceId');

    const user = await this.getUserIfExists(ctx);

    await this.db
      .insert(visitedWorkspaceTable)
      .values({
        browserId,
        createdAt: new Date().toISOString(),
        workspaceId,
        userId: user?.id,
      })
      .onConflictDoNothing({
        target: [
          visitedWorkspaceTable.browserId,
          visitedWorkspaceTable.workspaceId,
        ],
      });
  }

  private async getUserIfExists(ctx: Context<AppContext>) {
    const sessionId = getCookie(ctx, SESSION_COOKIE_NAME) ?? null;

    if (!sessionId) {
      return null;
    }

    // validate session token
    const { user } = await SessionService.validateSessionToken(sessionId, ctx);

    return user;
  }

  private getBrowserId(ctx: Context<AppContext>) {
    const cfConnectingIp = (ctx.req.raw.cf?.connecting_ip ||
      ctx.req.header('CF-Connecting-IP')) as string | undefined;

    return cfConnectingIp;
  }
}
