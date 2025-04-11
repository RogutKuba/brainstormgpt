import { jsonb, pgTable, text, boolean, index } from 'drizzle-orm/pg-core';
import { baseProperties } from './base';

export const chatTable = pgTable(
  'chats',
  {
    ...baseProperties,
    workspaceCode: text('workspace_code').notNull(),
    userId: text('user_id').notNull(),
    prompt: text('prompt').notNull(),
    response: text('response').notNull(),
    type: text('type').notNull(),
    isPremium: boolean('is_premium').notNull().default(false),
    newCitations: boolean('new_citations').notNull().default(false),
    // status can be success, error, pending, processing
    status: text('status').notNull(),
    error: jsonb('error'),
  },
  (t) => ({
    userIdIndex: index('user_id_index').on(t.userId),
  })
);

export type ChatEntity = typeof chatTable.$inferSelect;
