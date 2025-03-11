import { index, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { baseProperties } from './base';

export const crawledPageTable = pgTable(
  'crawled_pages',
  {
    ...baseProperties,
    workspaceId: text('workspace_id').notNull(),
    url: text('url').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    markdown: text('markdown').notNull(),
    html: text('html').notNull(),
    // status can be success, error, pending, processing
    status: text('status').notNull(),
    previewImageUrl: text('preview_image_url'),
    error: jsonb('error'),
  },
  (t) => [index('url_index').on(t.url)]
);

export type CrawledPageEntity = typeof crawledPageTable.$inferSelect;
