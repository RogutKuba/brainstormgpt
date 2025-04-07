import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { AppContext } from '..';
import { getDbConnection, takeUnique } from '../db/client';
import { Context } from 'hono';
import Stripe from 'stripe';
import { SubscriptionEntity, subscriptionTable } from '../db/subscription.db';
import { and, eq } from 'drizzle-orm';
import { Redirect } from '../lib/redirect';

export class BillingService {
  private readonly db: PostgresJsDatabase;
  private readonly stripe: Stripe;

  private env: AppContext['Bindings'];

  constructor(ctx: Context<AppContext>) {
    this.db = getDbConnection(ctx);

    this.stripe = new Stripe(ctx.env.STRIPE_SECRET_KEY);
    this.env = ctx.env;
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
    return this.stripe.webhooks.constructEventAsync(
      body,
      signature,
      this.env.STRIPE_WEBHOOK_SECRET
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
      .where(
        and(
          eq(subscriptionTable.stripeCustomerId, stripeCustomerId),
          eq(subscriptionTable.status, 'active')
        )
      )
      .then(takeUnique);
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
   * @returns
   */
  async createSubscriptionLink(stripeCustomerId: string) {
    return this.stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      line_items: [
        {
          price: this.env.STRIPE_PRO_PLAN_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: Redirect.account(this.env.WEB_APP_URL),
      cancel_url: Redirect.account(this.env.WEB_APP_URL),
    });
  }

  /**
   * Create billing portal link for a user
   * @param stripeCustomerId
   * @returns
   */
  async createBillingPortalLink(stripeCustomerId: string) {
    return this.stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: Redirect.account(this.env.WEB_APP_URL),
    });
  }
}
