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
import { ShapeService } from '../service/Shape.service';
import { RoomSnapshot } from '@tldraw/sync-core';
import { BrainstormService } from '../service/Brainstorm.service';

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
    const db = getDbConnection(ctx);

    // Check if user is authenticated
    const { user } = getSession(ctx);

    const workspaceId = crypto.randomUUID().substring(0, 8);

    // init the durable object for the workspace
    const workspaceDoId = ctx.env.TLDRAW_DURABLE_OBJECT.idFromName(workspaceId);
    const workspaceDo = ctx.env.TLDRAW_DURABLE_OBJECT.get(workspaceDoId);
    await workspaceDo.init({ workspaceId });

    const predictions = await BrainstormService.generatePredictions({
      prompt,
      nodeContent: prompt,
      chatHistory: [],
      ctx,
    });

    // actually create the shape
    const baseSnapshot =
      (await workspaceDo.getCurrentSnapshot()) as unknown as RoomSnapshot;
    const shapeService = new ShapeService(baseSnapshot);
    const rootShape = shapeService.createRootShape(prompt, predictions);

    await workspaceDo.addRecords([rootShape]);

    // Create workspace in database
    const newWorkspace: WorkspaceEntity = {
      id: workspaceId,
      createdAt: new Date().toISOString(),
      ownerId: user.id,
      name,
      prompt,
      doId: workspaceDoId.toString(),
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
