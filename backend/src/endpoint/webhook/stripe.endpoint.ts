import { AppContext } from '../..';
import { ErrorResponses } from '../errors';
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { BillingService } from '../../service/Billing.service';

const webhookRoute = createRoute({
  method: 'post',
  path: '/stripe-webhook',
  responses: {
    200: {
      description: 'Returns successuflly handled webhook',
    },
    ...ErrorResponses,
  },
});

export const stripeRouter = new OpenAPIHono<AppContext>().openapi(
  webhookRoute,
  async (ctx) => {
    const signature = ctx.req.header('stripe-signature');
    try {
      if (!signature) {
        return ctx.text('', 400);
      }
      const body = await ctx.req.text();

      const billingService = new BillingService(ctx);
      const event = await billingService.constructEvent(body, signature);

      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.deleted':
        case 'customer.subscription.updated': {
          await billingService.manageSubscriptionUpdate({ event });
          break;
        }
        default:
          break;
      }
      return ctx.text('Successfully handled webhook', 200);
    } catch (err) {
      const errorMessage = `Webhook signature verification failed. ${
        err instanceof Error ? err.message : 'Internal server error'
      }`;
      console.error(errorMessage);
      return ctx.text(errorMessage, 400);
    }
  }
);
