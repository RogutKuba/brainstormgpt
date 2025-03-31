import { boolean, index, pgTable, text } from 'drizzle-orm/pg-core';
import { userTable } from './user.db';
import { baseProperties, baseSchema } from './base';
import { z } from '@hono/zod-openapi';
import { sql } from 'drizzle-orm';

export const workspaceTable = pgTable(
  'workspaces',
  {
    ...baseProperties,
    code: text('code')
      .notNull()
      .default(sql`gen_random_uuid()`)
      .unique(),
    name: text('name').notNull(),
    ownerId: text('owner_id').notNull(),
    prompt: text('prompt').notNull(),
    doId: text('do_id').notNull(),
    isAnonymous: boolean('is_anonymous').notNull().default(false),
    isPublic: boolean('is_public').notNull().default(false),
  },
  (t) => ({
    codeIndex: index('code_index').on(t.code),
  })
);

export type WorkspaceEntity = typeof workspaceTable.$inferSelect;

export const workspaceSchema = baseSchema.extend({
  code: z.string(),
  name: z.string().min(1).max(100),
  ownerId: z.string().uuid(),
  prompt: z.string(),
  doId: z.string(),
  isAnonymous: z.boolean().default(false),
  isPublic: z.boolean().default(false),
});
