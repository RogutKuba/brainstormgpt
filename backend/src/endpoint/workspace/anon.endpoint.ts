import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { AppContext } from '../..';
import { ErrorResponses } from '../errors.js';
import { WorkspaceService } from '../../service/Workspace.service';
import { workspaceSchema } from '../../db/workspace.db';

// CREATE ANONYMOUS WORKSPACE ROUTE
const createAnonWorkspaceRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            prompt: z.string().min(3).max(1000).openapi({
              description: 'Prompt for the workspace',
            }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Anonymous workspace created successfully',
      content: {
        'application/json': {
          schema: workspaceSchema,
        },
      },
    },
    ...ErrorResponses,
  },
});

export const anonWorkspaceRouter = new OpenAPIHono<AppContext>().openapi(
  createAnonWorkspaceRoute,
  async (ctx) => {
    const { prompt } = ctx.req.valid('json');

    // Use the WorkspaceService to create an anonymous workspace
    const newWorkspace = await WorkspaceService.createAnonWorkspace({
      prompt,
      ctx,
    });

    return ctx.json(newWorkspace, 200);
  }
);
