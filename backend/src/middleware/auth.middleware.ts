import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { AppContext } from '../index.js';
import { HTTPException } from 'hono/http-exception';
import {
  SESSION_COOKIE_NAME,
  SessionService,
} from '../service/Session.service.js';

export const authMiddleware = createMiddleware<AppContext>(
  async (ctx, next) => {
    const sessionId = getCookie(ctx, SESSION_COOKIE_NAME) ?? null;

    // return no auth if no session cookie
    if (!sessionId) {
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    // validate session token
    const { session, user } = await SessionService.validateSessionToken(
      sessionId,
      ctx
    );

    if (!session) {
      SessionService.deleteSessionTokenCookie(ctx);
    }

    if (!user) {
      // return no auth
      throw new HTTPException(401, { message: 'Unauthorized' });
    }

    ctx.set('user', user);
    ctx.set('session', session);
    return next();
  }
);
