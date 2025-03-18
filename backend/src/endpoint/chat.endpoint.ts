import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { AppContext } from '..';
import { ErrorResponses } from './errors.js';
import { BrainstormService } from '../service/Brainstorm.service';
import { ShapeService } from '../service/Shape.service';
import { RoomSnapshot } from '@tldraw/sync-core';
import { TLShape, TLArrowBinding, TLShapeId } from 'tldraw';
import { GraphService } from '../service/Graph.service';

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

    const { newNodes, explanation } =
      await BrainstormService.generateBrainstorm({
        prompt: message,
        chatHistory,
        tree,
        ctx,
      });

    const { shapes: newShapes, bindings: newBindings } =
      shapeService.getShapePlacements(
        newNodes.map((node) => ({
          text: node.text,
          parentId: node.parentId ?? null,
        }))
      );
    const newShapeMap = new Map(newShapes.map((shape) => [shape.id, shape]));
    console.log('newShapes', [...newShapeMap.keys()]);

    // print out x and y of new shapes
    newShapes.forEach((shape) => {
      console.log('shape', shape.id, shape.x, shape.y);
    });

    const lastChangedClock = await workspace.getCurrentDocumentClock();

    // add new shapes to existing snapshot for rebalancing
    const updatedSnapshot = {
      ...snapshot,
      documents: [
        ...snapshot.documents,
        ...[...newShapes, ...newBindings].map((shape) => ({
          state: shape,
          lastChangedClock,
        })),
      ],
    };

    // now rebalance the graph
    const graphService = new GraphService({ snapshot: updatedSnapshot });
    const rebalancedNodes = graphService.rebalance();

    console.log('### PRINTING REBALANCED NODES ###');
    // replace the new shapes with the rebalanced nodes
    const rebalancedShapes = rebalancedNodes.map((node) => {
      const shape = newShapeMap.get(node.id);
      if (shape) {
        // print out the node x y for shape
        console.log('shape', shape.id, shape.x, shape.y, '->', node.x, node.y);

        return {
          ...shape,
          ...node,
        };
      }
      return node;
    });

    console.log('### PRINTING REBALANCED SHAPES ###');
    // print out the rebalanced shapes
    rebalancedShapes.forEach((shape) => {
      if (newShapeMap.has(shape.id)) {
        console.log('shape', shape.id, shape.x, shape.y);
      }
    });

    console.log('rebalancedShapes', rebalancedShapes);

    await workspace.updateShapes(rebalancedShapes, { createIfMissing: true });
    await workspace.addRecords(newBindings);

    return ctx.json({ message: explanation }, 200);
  }
);
