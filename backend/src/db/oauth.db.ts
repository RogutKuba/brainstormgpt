import {
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { userTable } from './user.db';
import { sql } from 'drizzle-orm';

export const oauthProviderIdEnum = pgEnum('oauth_provider_id_enum', ['google']);

export const oauthAccountsTable = pgTable(
  'oauth_accounts',
  {
    createdAt: timestamp('created_at', { mode: 'string' })
      .default(sql`now()`)
      .notNull(),
    providerId: oauthProviderIdEnum('provider_id').notNull(),
    providerUserId: text('provider_user_id').notNull().unique(),
    userId: text('user_id')
      .notNull()
      .references(() => userTable.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.providerId, table.providerUserId] }),
    };
  }
);

export type OauthAccountEntity = typeof oauthAccountsTable.$inferSelect;
