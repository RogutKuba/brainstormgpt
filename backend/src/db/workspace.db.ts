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
  prompt: text('prompt').notNull(),
  doId: text('do_id').notNull(),
});

export type WorkspaceEntity = typeof workspaceTable.$inferSelect;

export const workspaceSchema = baseSchema.extend({
  name: z.string().min(1).max(100),
  ownerId: z.string().uuid(),
  prompt: z.string(),
  doId: z.string(),
});
