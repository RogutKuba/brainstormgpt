import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { InferSelectModel } from 'drizzle-orm';
import { baseProperties } from './base';

export const userTable = pgTable('users', {
  ...baseProperties,
  name: text('name').notNull(),
  email: text('email').notNull(),
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
