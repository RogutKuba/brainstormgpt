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

// UPDATE WORKSPACE ROUTE
const updateWorkspaceRoute = createRoute({
  method: 'put',
  path: '/:code',
  request: {
    params: z.object({
      code: z.string().openapi({
        description: 'Workspace Code',
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: workspaceSchema
            .pick({ name: true, isPublic: true })
            .partial(),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Workspace updated successfully',
      content: {
        'application/json': {
          schema: workspaceSchema,
        },
      },
    },
    ...ErrorResponses,
  },
});

// DELETE WORKSPACE ROUTE
const deleteWorkspaceRoute = createRoute({
  method: 'delete',
  path: '/:code',
  request: {
    params: z.object({
      code: z.string().openapi({
        description: 'Workspace Code',
      }),
    }),
  },
  responses: {
    200: {
      description: 'Workspace deleted successfully',
      content: {
        'application/json': {
          schema: workspaceSchema,
        },
      },
    },
    ...ErrorResponses,
  },
});

export const workspaceRouter = new OpenAPIHono<AppContext>()
  .openapi(createWorkspaceRoute, async (ctx) => {
    const { prompt } = ctx.req.valid('json');

    // Use the WorkspaceService to create the workspace
    const newWorkspace = await WorkspaceService.createWorkspace({
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
  })
  .openapi(updateWorkspaceRoute, async (ctx) => {
    const { code } = ctx.req.valid('param');
    const { name, isPublic } = ctx.req.valid('json');

    const updatedWorkspace = await WorkspaceService.updateWorkspace({
      code,
      update: { name, isPublic },
      ctx,
    });

    return ctx.json(updatedWorkspace, 200);
  })
  .openapi(deleteWorkspaceRoute, async (ctx) => {
    const { code } = ctx.req.valid('param');

    const deletedWorkspace = await WorkspaceService.deleteWorkspace({
      code,
      ctx,
    });

    return ctx.json(deletedWorkspace, 200);
  });
