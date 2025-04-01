import { OpenAPIHono, z, createRoute } from '@hono/zod-openapi';
import { UserSchema, userTable } from '../db/user.db';
import { getCookie, setCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import { getDbConnection, takeUniqueOrThrow } from '../db/client';
import { ErrorResponses } from './errors.js';
import { AppContext } from '../index.js';
import { googleAuthRouter } from './oauth.endpoint.js';
import {
  SESSION_COOKIE_NAME,
  SessionService,
} from '../service/Session.service.js';

// GET CURRENT USER ROUTE
const currentUserRoute = createRoute({
  method: 'get',
  path: '/current-user',
  responses: {
    200: {
      description: 'Returns current user',
      content: {
        'application/json': {
          schema: UserSchema,
        },
      },
    },
    ...ErrorResponses,
  },
});

// LOGOUT ROUTE
const logoutRoute = createRoute({
  method: 'get',
  path: '/logout',
  responses: {
    200: {
      description: 'Returns successful logout',
      content: {
        'application/json': {
          schema: z.object({}),
        },
      },
    },
    ...ErrorResponses,
  },
});

export const authRouter = new OpenAPIHono<AppContext>()
  // GET CURRENT USER ROUTE
  .openapi(currentUserRoute, async (ctx) => {
    const db = getDbConnection(ctx);

    const sessionId = getCookie(ctx, SESSION_COOKIE_NAME) ?? null;

    if (!sessionId) {
      return ctx.text('Not authenticated', 401);
    }
    const { session, user } = await SessionService.validateSessionToken(
      sessionId,
      ctx
    );

    if (!session || !user) {
      return ctx.text('Not authenticated', 401);
    }

    const userId = user.id;
    const userData = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, userId))
      .then(takeUniqueOrThrow);

    return ctx.json(
      {
        id: userData.id,
        createdAt: userData.createdAt,
        email: userData.email,
        name: userData.name,
        imageUrl: userData.imageUrl,
      },
      200
    );
  })
  // LOGOUT ROUTE
  .openapi(logoutRoute, async (ctx) => {
    const sessionId = getCookie(ctx, SESSION_COOKIE_NAME) ?? null;

    if (!sessionId) {
      return ctx.text('Not authenticated', 401);
    }

    await SessionService.invalidateSession(sessionId, ctx);

    const BLANK_SESSION_COOKIE = {
      name: SESSION_COOKIE_NAME,
      value: '',
      attributes: {
        expires: new Date(0),
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      },
    } as const;
    setCookie(
      ctx,
      BLANK_SESSION_COOKIE.name,
      BLANK_SESSION_COOKIE.value,
      BLANK_SESSION_COOKIE.attributes
    );

    return ctx.json({}, 200);
  })
  .route('google', googleAuthRouter);
