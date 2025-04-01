import { Google } from 'arctic';
import { getDbConnection, takeUnique } from '../db/client';
import { OauthAccountEntity, oauthAccountsTable } from '../db/oauth.db';
import { and, eq } from 'drizzle-orm';
import { Context } from 'hono';
import { AppContext } from '..';
import { UserEntity, userTable } from '../db/user.db';
import { SessionService } from './Session.service.js';
import { generateId } from '../lib/id';

export type GoogleUser = {
  iss: string;
  azp: string;
  aud: string;
  sub: string;
  email: string;
  email_verified: boolean;
  at_hash: string;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
  iat: number;
  exp: number;
};

export const GoogleOauthService = {
  getGoogleClient: (ctx: Context<AppContext>) => {
    return new Google(
      ctx.env.GOOGLE_CLIENT_ID,
      ctx.env.GOOGLE_CLIENT_SECRET,
      ctx.env.GOOGLE_REDIRECT_URI
    );
  },
  loginGoogleUser: async (params: {
    googleUser: GoogleUser;
    ctx: Context<AppContext>;
  }): Promise<string> => {
    const { googleUser, ctx } = params;
    const db = getDbConnection(ctx);

    // check if google oauth account already exists
    const existing = await db
      .select()
      .from(oauthAccountsTable)
      .where(
        and(
          eq(oauthAccountsTable.providerId, 'google'),
          eq(oauthAccountsTable.providerUserId, params.googleUser.sub)
        )
      )
      .innerJoin(userTable, eq(oauthAccountsTable.userId, userTable.id))
      .then(takeUnique);

    if (existing) {
      // fetch user and redirect to account dashboard
      const { users: existingUser } = existing;

      const token = SessionService.generateSessionToken();
      const session = await SessionService.createSession({
        token,
        userId: existingUser.id,
        db,
      });
      SessionService.setSessionTokenCookie(token, session.expiresAt, ctx);

      ctx.set('user', existingUser);
      ctx.set('session', session);

      return `${ctx.env.WEB_APP_URL}/app`;
    }

    // check if user with email already exists
    const existingEmail = await db
      .select()
      .from(userTable)
      .where(eq(userTable.email, googleUser.email))
      .then(takeUnique);

    if (existingEmail) {
      // need to create oauth account
      const { user, session } = await db.transaction(async (tx) => {
        const oauthAccount: OauthAccountEntity = {
          providerId: 'google',
          providerUserId: googleUser.sub,
          userId: existingEmail.id,
          createdAt: new Date().toISOString(),
        };

        await tx.insert(oauthAccountsTable).values(oauthAccount);

        const token = SessionService.generateSessionToken();
        const session = await SessionService.createSession({
          token,
          userId: existingEmail.id,
          db: tx,
        });
        SessionService.setSessionTokenCookie(token, session.expiresAt, ctx);

        return {
          user: existingEmail,
          session,
        };
      });

      ctx.set('user', user);
      ctx.set('session', session);
      return `${ctx.env.WEB_APP_URL}/app`;
    }

    // need to create a new user
    const { user, session } = await db.transaction(async (tx) => {
      const email = googleUser.email;

      const newUser: UserEntity = {
        id: generateId('user'),
        createdAt: new Date().toISOString(),
        email,
        name: googleUser.name,
      };

      await tx.insert(userTable).values(newUser);

      const oauthAccount: OauthAccountEntity = {
        createdAt: new Date().toISOString(),
        providerId: 'google',
        providerUserId: googleUser.sub,
        userId: newUser.id,
      };

      await tx.insert(oauthAccountsTable).values(oauthAccount);

      const token = SessionService.generateSessionToken();
      const session = await SessionService.createSession({
        token,
        userId: newUser.id,
        db: tx,
      });
      SessionService.setSessionTokenCookie(token, session.expiresAt, ctx);

      return {
        user: newUser,
        session,
      };
    });

    ctx.set('user', user);
    ctx.set('session', session);

    return `${ctx.env.WEB_APP_URL}/app`;
  },
};
