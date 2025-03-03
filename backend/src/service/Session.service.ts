import {
  UserEntity,
  SessionEntity,
  sessionTable,
  userTable,
} from '../db/user.db';
import { Context } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { AppContext } from '..';
import { getDbConnection } from '../db/client';
import { eq } from 'drizzle-orm';
import {
  encodeBase32LowerCaseNoPadding,
  encodeHexLowerCase,
} from '@oslojs/encoding';
import { sha256 } from '@oslojs/crypto/sha2';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';

export const SESSION_COOKIE_NAME = 'brainstormgpt-session';

export type SessionValidationResult =
  | { session: SessionEntity; user: UserEntity }
  | { session: null; user: null };

export const SessionService = {
  generateSessionToken(): string {
    const bytes = new Uint8Array(20);
    crypto.getRandomValues(bytes);
    const token = encodeBase32LowerCaseNoPadding(bytes);
    return token;
  },
  createSession: async (params: {
    token: string;
    userId: string;
    db: PostgresJsDatabase;
  }): Promise<SessionEntity> => {
    const { token, userId, db } = params;

    const sessionId = encodeHexLowerCase(
      sha256(new TextEncoder().encode(token))
    );
    const session: SessionEntity = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      userId,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    };
    await db.insert(sessionTable).values(session);
    return session;
  },
  validateSessionToken: async (
    token: string,
    ctx: Context<AppContext>
  ): Promise<SessionValidationResult> => {
    const db = getDbConnection(ctx);

    const sessionId = encodeHexLowerCase(
      sha256(new TextEncoder().encode(token))
    );
    const result = await db
      .select({ user: userTable, session: sessionTable })
      .from(sessionTable)
      .innerJoin(userTable, eq(sessionTable.userId, userTable.id))
      .where(eq(sessionTable.id, sessionId));
    if (result.length < 1) {
      return { session: null, user: null };
    }
    const { user, session } = result[0];
    if (Date.now() >= session.expiresAt.getTime()) {
      await db.delete(sessionTable).where(eq(sessionTable.id, session.id));
      return { session: null, user: null };
    }
    if (Date.now() >= session.expiresAt.getTime() - 1000 * 60 * 60 * 24 * 15) {
      session.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
      await db
        .update(sessionTable)
        .set({
          expiresAt: session.expiresAt,
        })
        .where(eq(sessionTable.id, session.id));
    }
    return { session, user };
  },
  invalidateSession: async (
    sessionId: string,
    ctx: Context<AppContext>
  ): Promise<void> => {
    const db = getDbConnection(ctx);
    await db.delete(sessionTable).where(eq(sessionTable.id, sessionId));
  },
  setSessionTokenCookie: (
    token: string,
    expiresAt: Date,
    ctx: Context<AppContext>
  ) => {
    if (ctx.env.NODE_ENV === 'production') {
      setCookie(ctx, SESSION_COOKIE_NAME, token, {
        expires: expiresAt,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
        domain: 'wallstreetwrapped.com',
      });
    } else {
      setCookie(ctx, SESSION_COOKIE_NAME, token, {
        expires: expiresAt,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        domain: 'localhost',
      });
    }
  },
  deleteSessionTokenCookie: (ctx: Context<AppContext>) => {
    deleteCookie(ctx, SESSION_COOKIE_NAME, { path: '/' });
  },
};
