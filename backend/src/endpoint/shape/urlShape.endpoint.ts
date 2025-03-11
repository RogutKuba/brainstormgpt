import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { AppContext } from '../..';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { CrawlerService } from '../../service/Crawler.service';
import { workspaceTable } from '../../db/workspace.db';
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

    // Get the durable object for this workspace
    const workspaceDoId = ctx.env.TLDRAW_DURABLE_OBJECT.idFromName(workspaceId);
    const workspaceDo = ctx.env.TLDRAW_DURABLE_OBJECT.get(workspaceDoId);
    try {
      // Update the shape in the durable object

      // TODO: type instantiation is too deep below :(
      // @ts-ignore
      const currentShape = (await workspaceDo.getShape(shapeId)) as LinkShape;

      if (!currentShape) {
        throw new HTTPException(404, { message: 'Shape not found' });
      }

      // Initialize the crawler service
      const crawlerService = new CrawlerService({
        workspaceId,
        ctx,
      });

      // Crawl the URL
      const crawlResult = await crawlerService.crawl(url);

      if (!crawlResult) {
        throw new Error('Failed to crawl URL');
      }

      const updatedShape: LinkShape = {
        ...currentShape,
        props: {
          ...currentShape.props,
          url,
          isLoading: false,
          title: crawlResult.title,
          description: crawlResult.description,
          previewImageUrl: crawlResult.previewImageUrl,
        },
        typeName: 'shape',
      };

      await workspaceDo.updateShape(updatedShape);

      // spawn a workflow to crawl the page and create a summary
      const workflow = await ctx.env.ChunkWorkflow.create({
        params: {
          crawledPageId: crawlResult.id,
        },
      });

      console.log('Workflow spawned', workflow);

      return ctx.json(
        {
          ok: true,
        },
        200
      );
    } catch (error) {
      console.error(error);

      // TODO: type instantiation is too deep below :(
      // @ts-ignore
      const currentShape = (await workspaceDo.getShape(shapeId)) as LinkShape;

      if (!currentShape) {
        throw new HTTPException(404, { message: 'Shape not found' });
      }

      // update the shape to not be in error state
      const errorShape: LinkShape = {
        ...currentShape,
        props: {
          ...currentShape.props,
          isLoading: false,
          error: 'Failed to update link shape',
        },
      };

      await workspaceDo.updateShape(errorShape);

      throw new HTTPException(500, { message: 'Failed to update link shape' });
    }
  }
);
