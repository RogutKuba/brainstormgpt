import { sql } from 'drizzle-orm';
import { text, timestamp } from 'drizzle-orm/pg-core';
import { z } from 'zod';

export const baseSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
});

export const baseProperties = {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at', { mode: 'string' })
    .default(sql`now()`)
    .notNull(),
};
