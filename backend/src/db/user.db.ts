import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { InferSelectModel } from 'drizzle-orm';
import { baseProperties, baseSchema } from './base';
import { z } from '@hono/zod-openapi';

export const userTable = pgTable('users', {
  ...baseProperties,
  name: text('name').notNull(),
  email: text('email').notNull(),
  imageUrl: text('image_url'),
});

export const sessionTable = pgTable('sessions', {
  ...baseProperties,
  userId: text('user_id')
    .notNull()
    .references(() => userTable.id),
  expiresAt: timestamp('expires_at', {
    withTimezone: true,
    mode: 'date',
  }).notNull(),
});

export type UserEntity = InferSelectModel<typeof userTable>;
export type SessionEntity = InferSelectModel<typeof sessionTable>;

export const UserSchema = baseSchema.extend({
  name: z.string(),
  email: z.string(),
  imageUrl: z.string().nullable(),
});
