import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { AppContext } from '..';
import { ErrorResponses } from './errors.js';
import { LLMService } from '../service/LLM.service';
import {
  brainstormResultSchema,
  BrainstormService,
} from '../service/Brainstorm.service';
import { ShapeService } from '../service/Shape.service';
import { RoomSnapshot } from '@tldraw/sync-core';
import { StreamService } from '../service/Stream.service';

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
        'text/event-stream': {
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

export const streamRouter = new OpenAPIHono<AppContext>().openapi(
  sendMessageRoute,
  async (ctx) => {
    const { workspaceId } = ctx.req.valid('param');
    const { message, chatHistory, selectedItems } = ctx.req.valid('json');

    // Create a readable stream for the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial message
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode('event: start\ndata: {"status":"started"}\n\n')
          );

          // Get the workspace snapshot
          const id = ctx.env.TLDRAW_DURABLE_OBJECT.idFromName(workspaceId);
          const workspace = ctx.env.TLDRAW_DURABLE_OBJECT.get(id);
          const snapshot =
            (await workspace.getCurrentSnapshot()) as unknown as RoomSnapshot;

          // Create shape service and get the tree
          const shapeService = new ShapeService(snapshot);
          const tree = shapeService.getSelectedTree(selectedItems);

          // create stream service
          const streamService = new StreamService(controller);

          // Use LLMService to stream the response
          const finalResult = await BrainstormService.streamBrainstorm({
            prompt: message,
            chatHistory,
            tree,
            streamService,
            ctx,
          });

          // Handle final result by parsing into shapes and bindings and adding to workspace iff doesnt exist
          const { shapes, bindings } = shapeService.getTlShapesAndBindings(
            finalResult?.nodes ?? []
          );

          await streamService.handleCompletedNodeShapes({
            shapes,
            bindings,
            workspaceId,
            ctx,
          });

          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.enqueue(
            new TextEncoder().encode(
              `event: error\ndata: ${JSON.stringify({
                error:
                  error instanceof Error
                    ? error.message
                    : 'An error occurred during processing',
              })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }
);
