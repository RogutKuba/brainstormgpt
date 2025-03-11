import { index, integer, pgTable, text } from 'drizzle-orm/pg-core';
import { baseProperties } from './base';

export const pageChunkTable = pgTable(
  'page_chunks',
  {
    ...baseProperties,
    url: text('url').notNull(),
    index: integer('index').notNull(),
    type: text('type').notNull(),
    content: text('content').notNull(),
  },
  (t) => [index('chunk_url_index').on(t.url)]
);

export type PageChunkEntity = typeof pageChunkTable.$inferSelect;
