import { AppContext } from '..';
import { getDbConnectionFromEnv } from '../db/client';
import { crawledPageTable } from '../db/crawledPage.db';
import { eq, and } from 'drizzle-orm';
import { takeUnique } from '../db/client';
import { PageSummaryEntity, pageSummaryTable } from '../db/pageSummary.db';
import { generateId } from '../lib/id';
import { LLMService } from './LLM.service';

/**
 * Service to create summaries for pages
 */
export const SummaryService = {
  // create a summary for a page
  async createPageSummary(params: {
    crawledPageId: string;
    env: AppContext['Bindings'];
  }): Promise<void> {
    const { crawledPageId, env } = params;

    const db = getDbConnectionFromEnv(env);

    // if summary already exists, we can skip the summary
    const existingPageSummary = await db
      .select()
      .from(pageSummaryTable)
      .where(eq(pageSummaryTable.url, crawledPageId))
      .then(takeUnique);

    if (existingPageSummary) {
      return;
    }

    // Get the crawled page
    const crawledPage = await db
      .select({
        id: crawledPageTable.id,
        url: crawledPageTable.url,
        title: crawledPageTable.title,
        description: crawledPageTable.description,
        markdown: crawledPageTable.markdown,
        workspaceId: crawledPageTable.workspaceId,
      })
      .from(crawledPageTable)
      .where(
        and(
          eq(crawledPageTable.id, crawledPageId),
          eq(crawledPageTable.status, 'success')
        )
      )
      .then(takeUnique);

    if (!crawledPage) {
      throw new Error(
        `Crawled page ${crawledPageId} not found or was not successful`
      );
    }

    // Truncate markdown if it's too long
    // Most LLMs have a token limit around 8k-16k tokens
    // A rough estimate is that 1 token ≈ 4 characters
    const MAX_CHARS = 32000; // Conservative limit (8k tokens)
    const truncatedMarkdown =
      crawledPage.markdown.length > MAX_CHARS
        ? crawledPage.markdown.substring(0, MAX_CHARS) +
          '\n\n[Content truncated due to length...]'
        : crawledPage.markdown;

    // Generate summaries using LLM
    const summaryPrompt = `
    Please analyze the following content and provide:
    1. A brief gist (1-2 sentences)
    2. 3-5 key points
    3. A detailed summary (3-4 paragraphs)
    4. Any important entities, people, companies, or concepts mentioned (comma-separated list)
    
    Format your response as:
    <gist>Brief overview of the content</gist>
    <key-points>
    - Key point 1
    - Key point 2
    - Key point 3
    </key-points>
    <detailed-summary>
    Paragraph 1...
    
    Paragraph 2...
    </detailed-summary>
    <mentions>entity1, entity2, person1, concept1</mentions>
    
    Content to analyze:
    Title: ${crawledPage.title}
    Description: ${crawledPage.description}
    
    ${truncatedMarkdown}
    `;

    const summaryResponse = await LLMService.generateMessage({
      prompt: summaryPrompt,
      chatHistory: [],
      env,
    });

    // Parse the response
    const gistMatch = summaryResponse.match(/<gist>([\s\S]*?)<\/gist>/);
    const keyPointsMatch = summaryResponse.match(
      /<key-points>([\s\S]*?)<\/key-points>/
    );
    const detailedSummaryMatch = summaryResponse.match(
      /<detailed-summary>([\s\S]*?)<\/detailed-summary>/
    );
    const mentionsMatch = summaryResponse.match(
      /<mentions>([\s\S]*?)<\/mentions>/
    );

    // Extract the content
    const gist = gistMatch ? gistMatch[1].trim() : 'No gist available';
    const keyPoints = keyPointsMatch
      ? keyPointsMatch[1].trim()
      : 'No key points available';
    const detailedSummary = detailedSummaryMatch
      ? detailedSummaryMatch[1].trim()
      : 'No detailed summary available';
    const mentions = mentionsMatch ? mentionsMatch[1].trim() : '';

    // Insert the summary into the database
    const pageSummary: PageSummaryEntity = {
      id: generateId('pageSummary'),
      createdAt: new Date().toISOString(),
      url: crawledPage.url,
      gist,
      keyPoints,
      detailedSummary,
      mentions,
    };

    await db.insert(pageSummaryTable).values(pageSummary);
  },
};
