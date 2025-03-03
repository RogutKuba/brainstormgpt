import { pgTable, text } from 'drizzle-orm/pg-core';
import { userTable } from './user.db';
import { baseProperties, baseSchema } from './base';
import { z } from '@hono/zod-openapi';

export const workspaceTable = pgTable('workspaces', {
  ...baseProperties,
  name: text('name').notNull(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => userTable.id),
  goalPrompt: text('goal_prompt'),
});

export type WorkspaceEntity = typeof workspaceTable.$inferSelect;

export const workspaceSchema = baseSchema.extend({
  name: z.string().min(1).max(100),
  ownerId: z.string().uuid(),
  goalPrompt: z.string().nullable(),
});
