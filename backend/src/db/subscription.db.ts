import { text, pgTable, timestamp } from 'drizzle-orm/pg-core';

export const subscriptionTable = pgTable('subscriptions', {
  stripeSubscriptionId: text('stripe_subscription_id').primaryKey(),
  stripeCustomerId: text('stripe_customer_id').notNull(),
  status: text('status').notNull(),
  startDate: timestamp('start_date', { mode: 'string' }).notNull(),
  canceledAt: timestamp('canceled_at', { mode: 'string' }),
  endedAt: timestamp('ended_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});

export type SubscriptionEntity = typeof subscriptionTable.$inferSelect;
