import { Context } from 'hono';
import { AppContext } from '..';
import { getDbConnection, takeUniqueOrThrow } from '../db/client';
import { WorkspaceEntity, workspaceTable } from '../db/workspace.db';
import { BrainstormService } from './Brainstorm.service';
import { ShapeService } from './Shape.service';
import { RoomSnapshot } from '@tldraw/sync-core';
import { getSession } from '../lib/session';
import { eq, desc } from 'drizzle-orm';
import { generateId } from '../lib/id';
import { CrawlerService } from './Crawler.service';

export class WorkspaceService {
  /**
   * Creates a new workspace for an authenticated user
   * @param params Parameters for workspace creation
   * @returns The created workspace entity
   */
  static async createWorkspace(params: {
    prompt: string;
    ctx: Context<AppContext>;
  }): Promise<WorkspaceEntity> {
    const { prompt, ctx } = params;
    const db = getDbConnection(ctx);

    // Check if user is authenticated
    const { user } = getSession(ctx);

    const workspaceCode = crypto.randomUUID().substring(0, 8);

    // Initialize the durable object for the workspace
    const workspaceDoId =
      ctx.env.TLDRAW_DURABLE_OBJECT.idFromName(workspaceCode);
    const workspaceDo = ctx.env.TLDRAW_DURABLE_OBJECT.get(workspaceDoId);
    await workspaceDo.init({ code: workspaceCode });

    const predictions = await BrainstormService.generatePredictions({
      prompt,
      nodeContent: prompt,
      chatHistory: [],
      ctx,
    });

    // Create the initial shape
    const baseSnapshot =
      (await workspaceDo.getCurrentSnapshot()) as unknown as RoomSnapshot;
    const shapeService = new ShapeService(baseSnapshot);
    const rootShape = shapeService.createRootShape(prompt, predictions);

    await workspaceDo.addRecords([rootShape]);

    if (rootShape.type === 'link') {
      // start crawling
      ctx.executionCtx.waitUntil(
        new Promise(async (resolve) => {
          const crawlerService = new CrawlerService({
            workspaceCode,
            ctx,
          });
          await crawlerService.updateLinkShapes({
            shapes: [{ shapeId: rootShape.id, url: rootShape.props.url }],
            context: '',
            ctx,
          });

          resolve(true);
        })
      );
    }

    // Create workspace in database
    const newWorkspace: WorkspaceEntity = {
      id: generateId('workspace'),
      code: workspaceCode,
      createdAt: new Date().toISOString(),
      ownerId: user.id,
      name: prompt,
      prompt,
      doId: workspaceDoId.toString(),
      isAnonymous: false,
      isPublic: false,
    };

    await db.insert(workspaceTable).values(newWorkspace);

    return newWorkspace;
  }

  /**
   * Creates a new anonymous workspace (no authentication required)
   * @param params Parameters for anonymous workspace creation
   * @returns The created workspace entity
   */
  static async createAnonWorkspace(params: {
    prompt: string;
    ctx: Context<AppContext>;
  }): Promise<WorkspaceEntity> {
    const { prompt, ctx } = params;
    const db = getDbConnection(ctx);

    const workspaceCode = crypto.randomUUID().substring(0, 8);

    // Initialize the durable object for the workspace
    const workspaceDoId =
      ctx.env.TLDRAW_DURABLE_OBJECT.idFromName(workspaceCode);
    const workspaceDo = ctx.env.TLDRAW_DURABLE_OBJECT.get(workspaceDoId);
    await workspaceDo.init({ code: workspaceCode });

    const predictions = await BrainstormService.generatePredictions({
      prompt,
      nodeContent: prompt,
      chatHistory: [],
      ctx,
    });

    // Create the initial shape
    const baseSnapshot =
      (await workspaceDo.getCurrentSnapshot()) as unknown as RoomSnapshot;
    const shapeService = new ShapeService(baseSnapshot);
    const rootShape = shapeService.createRootShape(prompt, predictions);

    await workspaceDo.addRecords([rootShape]);

    if (rootShape.type === 'link') {
      // start crawling
      ctx.executionCtx.waitUntil(
        new Promise(async (resolve) => {
          const crawlerService = new CrawlerService({
            workspaceCode,
            ctx,
          });
          await crawlerService.updateLinkShapes({
            shapes: [{ shapeId: rootShape.id, url: rootShape.props.url }],
            context: '',
            ctx,
          });

          resolve(true);
        })
      );
    }

    // Create workspace in database with anonymous owner
    const newWorkspace: WorkspaceEntity = {
      id: generateId('workspace'),
      code: workspaceCode,
      createdAt: new Date().toISOString(),
      ownerId: 'anonymous', // Use a special ID for anonymous workspaces
      name: prompt,
      prompt,
      doId: workspaceDoId.toString(),
      isPublic: true, // Anonymous workspaces are always public
      isAnonymous: true,
    };

    await db.insert(workspaceTable).values(newWorkspace);

    return newWorkspace;
  }

  /**
   * Gets a workspace by ID
   * @param params Parameters for getting a workspace
   * @returns The workspace entity or null if not found
   */
  static async getWorkspace(params: {
    id: string;
    ctx: Context<AppContext>;
  }): Promise<WorkspaceEntity> {
    const { id, ctx } = params;
    const db = getDbConnection(ctx);

    const workspace = await db
      .select()
      .from(workspaceTable)
      .where(eq(workspaceTable.id, id))
      .then(takeUniqueOrThrow);

    return workspace;
  }

  /**
   * Gets all workspaces for a user
   * @param params Parameters for getting workspaces
   * @returns Array of workspace entities
   */
  static async getUserWorkspaces(params: {
    userId: string;
    ctx: Context<AppContext>;
  }): Promise<WorkspaceEntity[]> {
    const { userId, ctx } = params;
    const db = getDbConnection(ctx);

    const workspaces = await db
      .select()
      .from(workspaceTable)
      .where(eq(workspaceTable.ownerId, userId))
      .orderBy(desc(workspaceTable.createdAt));

    return workspaces;
  }

  /**
   * Deletes a workspace by ID
   * @param params Parameters for deleting a workspace
   * @returns The deleted workspace entity
   */
  static async deleteWorkspace(params: {
    code: string;
    ctx: Context<AppContext>;
  }): Promise<WorkspaceEntity> {
    const { code, ctx } = params;
    const db = getDbConnection(ctx);

    const workspace = await db
      .delete(workspaceTable)
      .where(eq(workspaceTable.code, code))
      .returning()
      .then(takeUniqueOrThrow);

    return workspace;
  }

  /**
   * Updates a workspace by ID
   * @param params Parameters for updating a workspace
   * @returns The updated workspace entity
   */
  static async updateWorkspace(params: {
    code: string;
    update: Partial<Pick<WorkspaceEntity, 'name' | 'isPublic'>>;
    ctx: Context<AppContext>;
  }): Promise<WorkspaceEntity> {
    const { code, update, ctx } = params;
    const db = getDbConnection(ctx);

    const workspace = await db
      .update(workspaceTable)
      .set(update)
      .where(eq(workspaceTable.code, code))
      .returning()
      .then(takeUniqueOrThrow);

    return workspace;
  }
}
