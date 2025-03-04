import { pgTable, text, primaryKey } from 'drizzle-orm/pg-core';
import { workspaceTable } from './workspace.db';
import { z } from '@hono/zod-openapi';

export const visitedWorkspaceTable = pgTable(
  'visited_workspaces',
  {
    // browserId is used to identify the browser that visited the workspace
    browserId: text('browser_id').notNull(),
    workspaceId: text('workspace_id').notNull(),
    userId: text('user_id'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.browserId, t.workspaceId] }),
  })
);

export type VisitedWorkspaceEntity = typeof visitedWorkspaceTable.$inferSelect;

export const visitedWorkspaceSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  isAnonymous: z.boolean().default(false),
  visitedAt: z.date().default(() => new Date()),
});
