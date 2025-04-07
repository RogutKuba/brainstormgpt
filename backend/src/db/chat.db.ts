import { jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { baseProperties } from './base';

export const chatTable = pgTable('chats', {
  ...baseProperties,
  workspaceCode: text('workspace_code').notNull(),
  userId: text('user_id').notNull(),
  prompt: text('prompt').notNull(),
  response: text('response').notNull(),
  // status can be success, error, pending, processing
  status: text('status').notNull(),
  error: jsonb('error'),
});

export type ChatEntity = typeof chatTable.$inferSelect;
