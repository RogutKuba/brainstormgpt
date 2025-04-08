import { Context } from 'hono';
import { AppContext } from '../index.js';
import { HTTPException } from 'hono/http-exception';

export const getSession = (
  ctx: Context<AppContext>,
  params?: { notThrow?: boolean }
) => {
  const session = ctx.get('session');
  const user = ctx.get('user');

  if (!session || !user) {
    if (params?.notThrow) {
      return { session: null, user: null };
    }

    throw new HTTPException(401, { message: 'Unauthorized' });
  }

  return { session, user };
};
