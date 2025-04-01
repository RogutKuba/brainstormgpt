import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { AppContext } from '..';
import { ErrorResponses } from './errors.js';
import { HTTPException } from 'hono/http-exception';
import { workspaceSchema } from '../db/workspace.db';
import { getSession } from '../lib/session';
import { WorkspaceService } from '../service/Workspace.service';

// CREATE WORKSPACE ROUTE
const createWorkspaceRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(3).max(100).openapi({
              description: 'Name of the workspace',
            }),
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
      description: 'Workspace created successfully',
      content: {
        'application/json': {
          schema: workspaceSchema,
        },
      },
    },
    ...ErrorResponses,
  },
});

// GET WORKSPACE ROUTE
const getWorkspaceRoute = createRoute({
  method: 'get',
  path: '/:id',
  request: {
    params: z.object({
      id: z.string().openapi({
        description: 'Workspace ID',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Workspace details',
      content: {
        'application/json': {
          schema: workspaceSchema,
        },
      },
    },
    ...ErrorResponses,
  },
});

// GET ALL WORKSPACES ROUTE
const getAllWorkspacesRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      description: 'List of workspaces',
      content: {
        'application/json': {
          schema: z.array(workspaceSchema),
        },
      },
    },
    ...ErrorResponses,
  },
});

export const workspaceRouter = new OpenAPIHono<AppContext>()
  .openapi(createWorkspaceRoute, async (ctx) => {
    const { name, prompt } = ctx.req.valid('json');

    // Use the WorkspaceService to create the workspace
    const newWorkspace = await WorkspaceService.createWorkspace({
      name,
      prompt,
      ctx,
    });

    return ctx.json(newWorkspace, 200);
  })
  .openapi(getWorkspaceRoute, async (ctx) => {
    const { id } = ctx.req.valid('param');

    try {
      // Use the WorkspaceService to get the workspace
      const workspace = await WorkspaceService.getWorkspace({
        id,
        ctx,
      });

      return ctx.json(workspace, 200);
    } catch (error) {
      throw new HTTPException(404, { message: 'Workspace not found' });
    }
  })
  .openapi(getAllWorkspacesRoute, async (ctx) => {
    // Check if user is authenticated
    const { user } = getSession(ctx);

    // Use the WorkspaceService to get all workspaces for the user
    const workspaces = await WorkspaceService.getUserWorkspaces({
      userId: user.id,
      ctx,
    });

    return ctx.json(workspaces, 200);
  });
