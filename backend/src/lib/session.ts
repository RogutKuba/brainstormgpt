import { Context } from 'hono';
import { AppContext } from '../index.js';
import { HTTPException } from 'hono/http-exception';
import { SessionEntity, UserEntity } from '../db/user.db.js';

export const getSession = (ctx: Context<AppContext>) => {
  const session = ctx.get('session');
  const user = ctx.get('user');

  if (!session || !user) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }

  return { session, user };
};

export const getSessionUnsafe = (
  ctx: Context<AppContext>
): {
  session: SessionEntity | null;
  user: UserEntity | null;
} => {
  const session = ctx.get('session');
  const user = ctx.get('user');

  return { session, user };
};
