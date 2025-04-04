import { pgTable, text, primaryKey, timestamp } from 'drizzle-orm/pg-core';
import { z } from '@hono/zod-openapi';
import { sql } from 'drizzle-orm';

export const visitedWorkspaceTable = pgTable(
  'visited_workspaces',
  {
    // browserId is used to identify the browser that visited the workspace
    browserId: text('browser_id').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' })
      .notNull()
      .default(sql`now()`),
    workspaceCode: text('workspace_code').notNull(),
    userId: text('user_id'),
  },
  (t) => [primaryKey({ columns: [t.browserId, t.workspaceCode] })]
);

export type VisitedWorkspaceEntity = typeof visitedWorkspaceTable.$inferSelect;

export const visitedWorkspaceSchema = z.object({
  workspaceCode: z.string().uuid(),
  userId: z.string().uuid(),
  isAnonymous: z.boolean().default(false),
  visitedAt: z.date().default(() => new Date()),
});
