import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { AppContext } from '..';
import { ErrorResponses } from './errors.js';
import { LLMService } from '../service/LLM.service';
import {
  brainstormResultSchema,
  BrainstormService,
  brainstormStreamResultSchema,
} from '../service/Brainstorm.service';
import { ShapeService } from '../service/Shape.service';
import { RoomSnapshot } from '@tldraw/sync-core';
import { StreamService } from '../service/Stream.service';
import { HTTPException } from 'hono/http-exception';
import { TLShapeId } from '@tldraw/tlschema';

// SEND MESSAGE ROUTE
const sendMessageRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    params: z.object({
      workspaceCode: z.string().openapi({
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
            searchType: z.enum(['text', 'web', 'image']).openapi({
              description: 'Type of message',
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
    const { workspaceCode } = ctx.req.valid('param');
    const { message, chatHistory, searchType, selectedItems } =
      ctx.req.valid('json');
    // const searchType = 'web';

    if (searchType === 'web' && selectedItems.length !== 1) {
      throw new HTTPException(400, {
        message: 'Web search only supports single item selection',
      });
    }

    // for now force parentId equal to selectedItems id
    const parentId = selectedItems[0];

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
          const id = ctx.env.TLDRAW_DURABLE_OBJECT.idFromName(workspaceCode);
          const workspace = ctx.env.TLDRAW_DURABLE_OBJECT.get(id);
          const snapshot =
            (await workspace.getCurrentSnapshot()) as unknown as RoomSnapshot;

          // Create shape service and get the tree
          const shapeService = new ShapeService(snapshot);
          const tree = shapeService.getSelectedTree(selectedItems);
          const formattedShapes = await shapeService.extractShapesWithText({
            tree,
            ctx,
          });

          // create stream service
          const streamService = new StreamService(controller);

          const finalResult = await (async () => {
            switch (searchType) {
              case 'text':
                return BrainstormService.streamBrainstorm({
                  prompt: message,
                  chatHistory,
                  tree,
                  formattedShapes,
                  streamService,
                  ctx,
                });
              case 'web':
              case 'image':
                return BrainstormService.streamWebSearch({
                  prompt: message,
                  chatHistory,
                  parentId: parentId as TLShapeId,
                  tree,
                  formattedShapes,
                  streamService,
                  ctx,
                });
              default:
                throw new Error('Invalid search type');
            }
          })();

          // before adding shapes and bindings to workspace, we need to update the snapshot
          const newSnapshot =
            (await workspace.getCurrentSnapshot()) as unknown as RoomSnapshot;
          shapeService.updateSnapshot(newSnapshot);

          // Handle final result by parsing into shapes and bindings and adding to workspace iff doesnt exist
          const { shapes, bindings } = shapeService.getTlShapesAndBindings(
            finalResult?.nodes ?? []
          );

          await streamService.handleCompletedNodeShapes({
            shapes,
            bindings,
            context: formattedShapes,
            searchType,
            workspaceCode,
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
