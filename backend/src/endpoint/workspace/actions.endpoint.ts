import { Hono } from 'hono';
import { AppContext } from '../../index';
import { OpenAPIHono } from '@hono/zod-openapi';
import { workspaceAuthMiddleware } from '../../middleware/workspace.middleware';
import { connectAuthRouter } from './connect.endpoint';
import { streamRouter } from './stream.endpoint';
import { urlShapeRouter } from './urlShape.endpoint';

export const workspaceActionsRouter = new OpenAPIHono<AppContext>()
  .use(workspaceAuthMiddleware)
  .route('/connect/status', connectAuthRouter)
  .route('/stream', streamRouter)
  .route('/shape/url', urlShapeRouter);
