import { Context } from 'hono';
import { AppContext } from '..';
import FirecrawlApp, { ScrapeResponse } from '@mendable/firecrawl-js';
import { getDbConnection, takeUnique } from '../db/client';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { CrawledPageEntity, crawledPageTable } from '../db/crawledPage.db';
import { and, eq } from 'drizzle-orm';
import { generateId } from '../lib/id';
import { LinkShape } from '../shapes/Link.shape';

// TODO: replace with cloudflare browser rendering and make own scraper for less third-party dependencies
export class CrawlerService {
  private firecrawl: FirecrawlApp;
  private db: PostgresJsDatabase;

  private workspaceId: string;

  constructor(params: { workspaceId: string; ctx: Context<AppContext> }) {
    this.workspaceId = params.workspaceId;

    this.firecrawl = new FirecrawlApp({
      apiKey: params.ctx.env.FIRECRAWL_API_KEY,
    });
    this.db = getDbConnection(params.ctx);
  }

  async crawl(url: string) {
    // check if the page has already been crawled
    const existingPage = await this.db
      .select()
      .from(crawledPageTable)
      .where(
        and(
          eq(crawledPageTable.url, url),
          eq(crawledPageTable.status, 'success')
        )
      )
      .then(takeUnique);

    // if we already the url, return the cached content. If unavailable, user will just retry
    if (existingPage) {
      // insert the crawled page into the database
      const crawledPage: CrawledPageEntity = {
        id: generateId('crawledPage'),
        workspaceId: this.workspaceId,
        createdAt: new Date().toISOString(),
        status: 'success',
        previewImageUrl: existingPage.previewImageUrl,
        html: existingPage.html,
        title: existingPage.title,
        description: existingPage.description,
        url,
        markdown: existingPage.markdown,
        error: null,
      };
      await this.db.insert(crawledPageTable).values(crawledPage);

      return existingPage;
    }

    try {
      const scrapeResult = (await this.firecrawl.scrapeUrl(url, {
        formats: ['markdown', 'html'],
      })) as ScrapeResponse;

      // check if we error-ed out
      if (!scrapeResult.success) {
        const errorCrawledPage: CrawledPageEntity = {
          id: generateId('crawledPage'),
          url,
          error: scrapeResult.error ?? 'Unknown error!',
          workspaceId: this.workspaceId,
          title: '',
          description: '',
          markdown: '',
          html: '',
          status: 'error',
          createdAt: new Date().toISOString(),
          previewImageUrl: null,
        };

        // insert error into the database
        await this.db.insert(crawledPageTable).values(errorCrawledPage);
        return null;
      }

      // insert the crawled page into the database
      const crawledPage: CrawledPageEntity = {
        id: generateId('crawledPage'),
        workspaceId: this.workspaceId,
        createdAt: new Date().toISOString(),
        status: 'success',
        markdown: scrapeResult.markdown ?? '',
        html: scrapeResult.html ?? '',
        title: scrapeResult.metadata?.title ?? '',
        description: scrapeResult.metadata?.description ?? '',
        url,
        error: null,
        previewImageUrl: scrapeResult.metadata?.ogImage ?? null,
      };
      await this.db.insert(crawledPageTable).values(crawledPage);

      return crawledPage;
    } catch (error: unknown) {
      const errorCrawledPage: CrawledPageEntity = {
        id: generateId('crawledPage'),
        url,
        error: error instanceof Error ? error.message : 'Unknown error!',
        workspaceId: this.workspaceId,
        title: '',
        description: '',
        markdown: '',
        html: '',
        status: 'error',
        createdAt: new Date().toISOString(),
        previewImageUrl: null,
      };
      await this.db.insert(crawledPageTable).values(errorCrawledPage);

      console.error(error);

      return null;
    }
  }

  async updateLinkShapes(params: {
    shapes: {
      shapeId: string;
      url: string;
    }[];
    context: string;
    ctx: Context<AppContext>;
  }) {
    const { shapes, context, ctx } = params;

    // Get the durable object for this workspace
    const workspaceDoId = ctx.env.TLDRAW_DURABLE_OBJECT.idFromName(
      this.workspaceId
    );
    const workspaceDo = ctx.env.TLDRAW_DURABLE_OBJECT.get(workspaceDoId);

    const results = [];

    for (const shape of shapes) {
      const { shapeId, url } = shape;

      try {
        // Get the current shape from the durable object
        // @ts-ignore - Type instantiation is too deep as noted in the endpoint
        const currentShape = (await workspaceDo.getShape(shapeId)) as LinkShape;

        if (!currentShape) {
          throw new Error('Shape not found');
        }

        const updatedShape = await (async () => {
          const uncrawlable = this.handleUncrawlableUrl(url, currentShape);

          if (uncrawlable) {
            results.push({
              ok: true,
              shapeId,
              shape: uncrawlable,
            });
            return uncrawlable;
          }

          // Crawl the URL
          const crawlResult = await this.crawl(url);

          if (!crawlResult) {
            throw new Error('Failed to crawl URL');
          }

          // Update the shape with the crawled data
          const _updatedShape: LinkShape = {
            ...currentShape,
            props: {
              ...currentShape.props,
              url,
              status: 'analyzing',
              isLoading: true,
              title: crawlResult.title,
              description: crawlResult.description,
              previewImageUrl: crawlResult.previewImageUrl,
              error: null,
            },
            typeName: 'shape',
          };

          // Spawn a workflow to crawl the page and create a summary
          const workflow = await ctx.env.ChunkWorkflow.create({
            params: {
              workspaceId: this.workspaceId,
              shapeId,
              crawledPageId: crawlResult.id,
              context,
            },
          });

          console.log('Workflow spawned', workflow.id);

          results.push({
            ok: true,
            shapeId,
            shape: _updatedShape,
            crawlResult,
          });

          return _updatedShape;
        })();

        // Update the shape in the durable object
        await workspaceDo.updateShape(updatedShape);
      } catch (error) {
        console.error('Error updating link shape:', error);

        try {
          // @ts-ignore - Type instantiation is too deep as noted in the endpoint
          const currentShape = (await workspaceDo.getShape(
            shapeId
          )) as LinkShape;

          if (currentShape) {
            // Update the shape to be in error state
            const errorShape: LinkShape = {
              ...currentShape,
              props: {
                ...currentShape.props,
                status: 'error',
                isLoading: false,
                error:
                  error instanceof Error
                    ? error.message
                    : 'Failed to update link shape',
              },
            };

            await workspaceDo.updateShape(errorShape);

            results.push({
              ok: false,
              shapeId,
              error:
                error instanceof Error
                  ? error.message
                  : 'Failed to update link shape',
              shape: errorShape,
            });
          } else {
            results.push({
              ok: false,
              shapeId,
              error: 'Shape not found',
            });
          }
        } catch (innerError) {
          console.error('Error updating shape to error state:', innerError);
          results.push({
            ok: false,
            shapeId,
            error: 'Failed to update shape to error state',
          });
        }
      }
    }

    return results;
  }

  /**
   * Currently can't handle PDFs, or youtube links
   * @param url
   */
  handleUncrawlableUrl(url: string, currentShape: LinkShape): LinkShape | null {
    const isPdf = (() => {
      // check if extension is pdf, or site is usual pdf sites like arxiv
      const extension = url.split('.').pop();
      return extension === 'pdf' || url.includes('arxiv.org/pdf');
    })();
    const isYoutube = url.includes('youtube.com');

    // if one of these, want to return updated shape with completed state and
    if (isPdf || isYoutube) {
      const updatedShape: LinkShape = {
        ...currentShape,
        props: {
          ...currentShape.props,
          url,
          title: isYoutube ? 'YouTube' : 'PDF',
          description: isYoutube ? 'YouTube' : 'PDF Document',
          predictions: [],
          previewImageUrl: null,
          status: 'success',
          isLoading: false,
          error: null,
        },
      };

      return updatedShape;
    }

    return null;
  }
}
