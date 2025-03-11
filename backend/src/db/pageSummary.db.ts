import { index, pgTable, text } from 'drizzle-orm/pg-core';
import { baseProperties } from './base';

export const pageSummaryTable = pgTable(
  'page_summaries',
  {
    ...baseProperties,
    url: text('url').notNull(),
    gist: text('gist').notNull(),
    keyPoints: text('key_points').notNull(),
    detailedSummary: text('detailed_summary').notNull(),
    mentions: text('mentions').notNull(),
  },
  (t) => [index('summary_url_index').on(t.url)]
);

export type PageSummaryEntity = typeof pageSummaryTable.$inferSelect;
