import { Context } from 'hono';
import { AppContext } from '..';
import FirecrawlApp, { ScrapeResponse } from '@mendable/firecrawl-js';
import { getDbConnection, takeUnique } from '../db/client';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { CrawledPageEntity, crawledPageTable } from '../db/crawledPage.db';
import { and, eq } from 'drizzle-orm';
import { generateId } from '../lib/id';

export class CrawlerService {
  private firecrawl: FirecrawlApp;
  private db: PostgresJsDatabase;

  private workspaceId: string;

  constructor(params: {
    workspaceId: string;
    userId: string;
    ctx: Context<AppContext>;
  }) {
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
        markdown: existingPage.markdown,
        html: existingPage.html,
        title: existingPage.title,
        description: existingPage.description,
        url,
        error: null,
      };
      await this.db.insert(crawledPageTable).values(crawledPage);

      return existingPage;
    }

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
      title: scrapeResult.title ?? '',
      description: scrapeResult.description ?? '',
      url,
      error: null,
    };
    await this.db.insert(crawledPageTable).values(crawledPage);

    return scrapeResult;
  }
}
