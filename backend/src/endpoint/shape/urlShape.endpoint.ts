import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { AppContext } from '../..';
import { HTTPException } from 'hono/http-exception';
import { CrawlerService } from '../../service/Crawler.service';
import { ErrorResponses } from '../errors';
import { LinkShape } from '../../shapes/Link.shape';

const urlShapeRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    params: z.object({
      workspaceId: z.string().openapi({
        description: 'ID of the workspace',
      }),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            shapeId: z.string().openapi({
              description: 'ID of the shape to update',
            }),
            url: z.string().openapi({
              description: 'URL to crawl',
            }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Workspace created successfully',
      content: {
        'application/json': {
          schema: z.object({
            ok: z.boolean(),
          }),
        },
      },
    },
    ...ErrorResponses,
  },
});

export const urlShapeRouter = new OpenAPIHono<AppContext>().openapi(
  urlShapeRoute,
  async (ctx) => {
    const { workspaceId } = ctx.req.valid('param');
    const { shapeId, url } = await ctx.req.json();

    try {
      // Initialize the crawler service
      const crawlerService = new CrawlerService({
        workspaceId,
        ctx,
      });

      // Use the existing updateLinkShapes method to handle the URL crawling and shape updating
      const results = await crawlerService.updateLinkShapes({
        shapes: [{ shapeId, url }],
        context: '', // Empty context for single URL updates
        ctx,
      });

      // Check if there was an error with the shape update
      const result = results[0];
      if (!result || !result.ok) {
        const errorMessage = result?.error || 'Failed to update link shape';
        throw new HTTPException(500, { message: errorMessage });
      }

      return ctx.json(
        {
          ok: true,
        },
        200
      );
    } catch (error) {
      console.error(error);
      throw new HTTPException(500, {
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update link shape',
      });
    }
  }
);
