import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { AppContext } from '..';
import { ErrorResponses } from './errors.js';
import { HTTPException } from 'hono/http-exception';
import { getDbConnection, takeUnique } from '../db/client';
import {
  WorkspaceEntity,
  workspaceSchema,
  workspaceTable,
} from '../db/workspace.db';
import { getSession } from '../lib/session';
import { desc, eq } from 'drizzle-orm';

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
    const { name } = await ctx.req.json();
    const db = getDbConnection(ctx);

    // Check if user is authenticated
    const { user } = getSession(ctx);

    // Create workspace in database
    const newWorkspace: WorkspaceEntity = {
      id: crypto.randomUUID().substring(0, 8),
      createdAt: new Date().toISOString(),
      ownerId: user.id,
      name,
      goalPrompt: null,
    };

    await db.insert(workspaceTable).values(newWorkspace);

    return ctx.json(newWorkspace, 200);
  })
  .openapi(getWorkspaceRoute, async (ctx) => {
    const { id } = ctx.req.valid('param');

    const db = getDbConnection(ctx);

    // Get workspace from database
    const workspace = await db
      .select()
      .from(workspaceTable)
      .where(eq(workspaceTable.id, id))
      .then(takeUnique);

    if (!workspace) {
      throw new HTTPException(404, { message: 'Workspace not found' });
    }

    return ctx.json(workspace, 200);
  })
  .openapi(getAllWorkspacesRoute, async (ctx) => {
    const db = getDbConnection(ctx);

    // Check if user is authenticated
    const { user } = getSession(ctx);

    // Get all workspaces for the user
    const workspaces = await db
      .select()
      .from(workspaceTable)
      .where(eq(workspaceTable.ownerId, user.id))
      .orderBy(desc(workspaceTable.createdAt));

    return ctx.json(workspaces, 200);
  });
