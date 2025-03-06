import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { AppContext } from '..';
import { ErrorResponses } from './errors.js';
import { BrainstormService } from '../service/Brainstorm.service';
import { ShapeService } from '../service/Shape.service';
import { RoomSnapshot } from '@tldraw/sync-core';

// SEND MESSAGE ROUTE
const sendMessageRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    params: z.object({
      workspaceId: z.string().openapi({
        description: 'Workspace ID',
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            message: z.string().min(3).openapi({
              description: 'Message to send',
            }),
            chatHistory: z
              .array(
                z.object({
                  content: z.string(),
                  sender: z.enum(['user', 'system']),
                })
              )
              .openapi({
                description: 'Previous chat messages for context',
              }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Message sent successfully',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string().openapi({
              description: 'Response from the AI',
            }),
          }),
        },
      },
    },
    ...ErrorResponses,
  },
});

export const chatRouter = new OpenAPIHono<AppContext>().openapi(
  sendMessageRoute,
  async (ctx) => {
    const { workspaceId } = ctx.req.valid('param');
    const { message, chatHistory } = ctx.req.valid('json');

    // make fake delay of 2 seconds
    const { newShapes, explanation } =
      await BrainstormService.generateBrainstorm({
        prompt: message,
        chatHistory,
        shapes: [],
        ctx,
      });

    const id = ctx.env.TLDRAW_DURABLE_OBJECT.idFromName(workspaceId);
    const workspace = ctx.env.TLDRAW_DURABLE_OBJECT.get(id);

    const snapshot =
      (await workspace.getCurrentSnapshot()) as unknown as RoomSnapshot;

    const shapeService = new ShapeService(snapshot);

    const shapePlacements = await shapeService.getShapePlacements(
      newShapes.map((shape) => ({
        text: shape.text,
        parentId: shape.parentId ?? null,
      }))
    );

    // now actually add shapes to workspace
    await workspace.addShapes(shapePlacements);

    console.log(shapePlacements);

    return ctx.json({ message: explanation }, 200);
  }
);
