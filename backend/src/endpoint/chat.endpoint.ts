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
            selectedItems: z.array(z.string()).openapi({
              description: 'Selected items ids for context',
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
    const { message, chatHistory, selectedItems } = ctx.req.valid('json');

    const id = ctx.env.TLDRAW_DURABLE_OBJECT.idFromName(workspaceId);
    const workspace = ctx.env.TLDRAW_DURABLE_OBJECT.get(id);

    const snapshot =
      (await workspace.getCurrentSnapshot()) as unknown as RoomSnapshot;

    const shapeService = new ShapeService(snapshot);

    // need to construct tree of shapes from the ids and bindings between them
    const tree = shapeService.getSelectedTree(selectedItems);

    const { newShapes, explanation } =
      await BrainstormService.generateBrainstorm({
        prompt: message,
        chatHistory,
        tree,
        ctx,
      });

    const shapePlacements = shapeService.getShapePlacements(
      newShapes.map((shape) => ({
        text: shape.text,
        parentId: shape.parentId ?? null,
      }))
    );

    // now actually add shapes to workspace
    await workspace.addRecords(shapePlacements);

    return ctx.json({ message: explanation }, 200);
  }
);
