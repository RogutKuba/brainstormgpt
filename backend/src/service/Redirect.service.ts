import { Context } from 'hono';
import { AppContext } from '..';

export const RedirectService = {
  baseUrl: (ctx: Context<AppContext>) => ctx.env.WEB_APP_URL,
  redirectToWorkspace: (params: {
    workspaceCode: string;
    ctx: Context<AppContext>;
  }) => `${process.env.WEB_APP_URL}/chat/${params.workspaceCode}`,
};
