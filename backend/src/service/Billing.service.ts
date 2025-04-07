import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { AppContext } from '..';
import { getDbConnection, takeUniqueOrThrow } from '../db/client';
import { Context } from 'hono';
import Stripe from 'stripe';
import { SubscriptionEntity, subscriptionTable } from '../db/subscription.db';
import { eq } from 'drizzle-orm';

export class BillingService {
  private readonly db: PostgresJsDatabase;
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(ctx: Context<AppContext>) {
    this.db = getDbConnection(ctx);

    this.stripe = new Stripe(ctx.env.STRIPE_SECRET_KEY);
    this.webhookSecret = ctx.env.STRIPE_WEBHOOK_SECRET;
  }

  /**
   * Create a stripe customer for a user
   * @param email
   * @returns
   */
  async createStripeCustomer(email: string) {
    return this.stripe.customers.create({ email });
  }

  /**
   * Construct event from stripe webhooks
   * @param body
   * @param signature
   * @returns
   */
  async constructEvent(body: string, signature: string) {
    return this.stripe.webhooks.constructEvent(
      body,
      signature,
      this.webhookSecret
    );
  }

  /**
   * Manage subscription update from stripe webhooks
   * @param event
   */
  async manageSubscriptionUpdate({
    event,
  }: {
    event:
      | Stripe.CustomerSubscriptionCreatedEvent
      | Stripe.CustomerSubscriptionUpdatedEvent
      | Stripe.CustomerSubscriptionDeletedEvent;
  }) {
    const db = this.db;

    // Must provision subscription for customer
    const stripeCustomerId = event.data.object.customer as string;
    if (!stripeCustomerId) {
      throw new Error('Missing stripeCustomerId');
    }

    const subscriptionItem = event.data.object.items.data.find(
      (item) => item.object === 'subscription_item'
    );

    if (!subscriptionItem) {
      throw new Error('Missing subscriptionItem');
    }

    // create subscription object
    const newSubscription: SubscriptionEntity = {
      stripeSubscriptionId: event.data.object.id,
      stripeCustomerId,
      status: event.data.object.status,
      startDate: new Date(event.data.object.start_date * 1000).toISOString(),
      canceledAt: event.data.object.canceled_at
        ? new Date(event.data.object.canceled_at * 1000).toISOString()
        : null,
      endedAt: event.data.object.ended_at
        ? new Date(event.data.object.ended_at * 1000).toISOString()
        : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const onConflictUpdateValues = {
      ...newSubscription,
      createdAt: undefined,
    };

    // insert subscription
    await db
      .insert(subscriptionTable)
      .values(newSubscription)
      .onConflictDoUpdate({
        target: subscriptionTable.stripeSubscriptionId,
        set: onConflictUpdateValues,
      });
  }

  /**
   * Gets active subscription for a user by stripe customer id
   * @param stripeCustomerId
   * @returns
   */
  async getSubscription(stripeCustomerId: string) {
    return this.db
      .select()
      .from(subscriptionTable)
      .where(eq(subscriptionTable.stripeCustomerId, stripeCustomerId))
      .then(takeUniqueOrThrow);
  }

  /**
   * Get all subscriptions, regardless of status
   */
  async getAllSubscriptions() {
    return this.db.select().from(subscriptionTable);
  }

  /**
   * Create subscription link for a user
   * @param stripeCustomerId
   * @param returnUrl
   * @returns
   */
  async createSubscriptionLink(stripeCustomerId: string, returnUrl: string) {
    return this.stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });
  }

  /**
   * Create billing portal link for a user
   * @param stripeCustomerId
   * @param returnUrl
   * @returns
   */
  async createBillingPortalLink(stripeCustomerId: string, returnUrl: string) {
    return this.stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });
  }
}
