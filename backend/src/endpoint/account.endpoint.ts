import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { AppContext } from '..';
import { ErrorResponses } from './errors.js';
import { getSession } from '../lib/session';
import { BillingService } from '../service/Billing.service';
import { HTTPException } from 'hono/http-exception';
import { AnalyticsService } from '../service/Analytics.service';
import { getDbConnection } from '../db/client';
import { sql } from 'drizzle-orm';

// TODO: this route should prob just be part of auth/user endpoint eventually
// GET SUBSCRIPTION STATUS ROUTE
const getSubscriptionStatusRoute = createRoute({
  method: 'get',
  path: '/subscription',
  responses: {
    200: {
      description: 'Returns subscription status',
      content: {
        'application/json': {
          schema: z.object({
            status: z.enum(['pro', 'free']),
          }),
        },
      },
    },
    ...ErrorResponses,
  },
});

// CREATE SUBSCRIPTION ROUTE
const createSubscriptionRoute = createRoute({
  method: 'get',
  path: '/subscribe',
  responses: {
    200: {
      description: 'Returns checkout URL',
      content: {
        'application/json': {
          schema: z.object({
            url: z.string(),
          }),
        },
      },
    },
    ...ErrorResponses,
  },
});

// MANAGE BILLING ROUTE
const manageBillingRoute = createRoute({
  method: 'get',
  path: '/billing',
  responses: {
    200: {
      description: 'Returns billing portal link',
      content: {
        'application/json': {
          schema: z.object({
            url: z.string(),
          }),
        },
      },
    },
    ...ErrorResponses,
  },
});

// DELETE ACCOUNT ROUTE
const deleteAccountRoute = createRoute({
  method: 'delete',
  path: '/',
  responses: {
    200: {
      description: 'Account deleted successfully',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
    },
    ...ErrorResponses,
  },
});

export const accountRouter = new OpenAPIHono<AppContext>()
  // GET SUBSCRIPTION STATUS ROUTE
  .openapi(getSubscriptionStatusRoute, async (ctx) => {
    const { user } = getSession(ctx);
    const billingService = new BillingService(ctx);
    const analyticsService = new AnalyticsService(ctx);

    // if subscription is null, user is on free plan

    let start = performance.now();
    const subscription = await billingService.getSubscription(
      user.stripeCustomerId
    );
    let end = performance.now();
    console.log(`getSubscription took ${end - start}ms`);

    const status: 'pro' | 'free' = subscription ? 'pro' : 'free';

    start = performance.now();
    const premiumUsage = await (async () => {
      if (status === 'free') {
        return await analyticsService.getDailyPremiumSearches(user.id);
      }

      // pro users get unlimited premium searches, marked by -1
      return -1;
    })();
    end = performance.now();
    console.log(`getDailyPremiumSearches took ${end - start}ms`);

    const db = getDbConnection(ctx);
    start = performance.now();
    const chats = await db.execute(sql`SELECT * FROM chats`);
    end = performance.now();
    console.log(`getChats took ${end - start}ms`);

    return ctx.json({ status, premiumUsage, chats }, 200);
  })

  // CREATE SUBSCRIPTION ROUTE
  .openapi(createSubscriptionRoute, async (ctx) => {
    const { user } = getSession(ctx);
    const billingService = new BillingService(ctx);

    try {
      // Create checkout session
      const checkoutSession = await billingService.createSubscriptionLink(
        user.stripeCustomerId
      );

      if (!checkoutSession.url) {
        throw new HTTPException(500, {
          message: 'Failed to create subscription link',
        });
      }

      return ctx.json({ url: checkoutSession.url }, 200);
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw new HTTPException(500, {
        message: 'Failed to create subscription',
      });
    }
  })

  // MANAGE BILLING ROUTE
  .openapi(manageBillingRoute, async (ctx) => {
    const { user } = getSession(ctx);
    const billingService = new BillingService(ctx);

    try {
      const portalSession = await billingService.createBillingPortalLink(
        user.stripeCustomerId
      );

      return ctx.json({ url: portalSession.url }, 200);
    } catch (error) {
      console.error('Error creating billing portal link:', error);
      throw new HTTPException(500, {
        message: 'Failed to create billing portal link',
      });
    }
  })

  // DELETE ACCOUNT ROUTE
  .openapi(deleteAccountRoute, async () => {
    throw new HTTPException(500, {
      message: 'Not implemented',
    });
  });
