import { createMiddleware } from 'hono/factory';
import { AppContext } from '../index.js';
import { SessionService } from '../service/Session.service.js';

export const authMiddleware = createMiddleware<AppContext>(
  async (ctx, next) => {
    await SessionService.authenticateSession(ctx);
    return next();
  }
);
