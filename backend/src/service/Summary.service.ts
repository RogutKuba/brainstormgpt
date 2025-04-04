import { AppContext } from '..';
import { getDbConnectionFromEnv, takeFirst } from '../db/client';
import { crawledPageTable } from '../db/crawledPage.db';
import { eq, and, desc } from 'drizzle-orm';
import { takeUnique } from '../db/client';
import { PageSummaryEntity, pageSummaryTable } from '../db/pageSummary.db';
import { generateId } from '../lib/id';
import { LLMService } from './LLM.service';
import { z } from 'zod';

const summaryResultSchema = z.object({
  gist: z.string(),
  keyPoints: z.string(),
  detailedSummary: z.string(),
  mentions: z.string(),
});

/**
 * Service to create summaries for pages
 */
export const SummaryService = {
  // create a summary for a page
  async createPageSummary(params: {
    crawledPageUrl: string;
    env: AppContext['Bindings'];
  }): Promise<void> {
    const { crawledPageUrl, env } = params;

    const db = getDbConnectionFromEnv(env);

    // if summary already exists, we can skip the summary
    const existingPageSummary = await db
      .select()
      .from(pageSummaryTable)
      .where(eq(pageSummaryTable.url, crawledPageUrl))
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
        workspaceCode: crawledPageTable.workspaceCode,
      })
      .from(crawledPageTable)
      .where(
        and(
          eq(crawledPageTable.url, crawledPageUrl),
          eq(crawledPageTable.status, 'success')
        )
      )
      .orderBy(desc(crawledPageTable.createdAt))
      .then(takeFirst);

    if (!crawledPage) {
      throw new Error(
        `Crawled page ${crawledPageUrl} not found or was not successful`
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
      structuredOutput: {
        name: 'summaryResult',
        schema: summaryResultSchema,
      },
    });

    const typedResult = summaryResponse as z.infer<typeof summaryResultSchema>;

    // Insert the summary into the database
    const pageSummary: PageSummaryEntity = {
      id: generateId('pageSummary'),
      createdAt: new Date().toISOString(),
      url: crawledPage.url,
      gist: typedResult.gist,
      keyPoints: typedResult.keyPoints,
      detailedSummary: typedResult.detailedSummary,
      mentions: typedResult.mentions,
    };

    await db.insert(pageSummaryTable).values(pageSummary);
  },

  branchPredictionsSchema: z.object({
    predictions: z.array(
      z.object({
        text: z.string(),
        type: z.enum(['text', 'image', 'web']),
      })
    ),
  }),

  // generate branch predictions for the page
  async generateBranchPredictions(params: {
    crawledPageUrl: string;
    context: string;
    env: AppContext['Bindings'];
  }): Promise<z.infer<typeof this.branchPredictionsSchema>['predictions']> {
    const { crawledPageUrl, context, env } = params;

    const db = getDbConnectionFromEnv(env);

    // get the page summary
    const pageSummary = await db
      .select()
      .from(pageSummaryTable)
      .where(eq(pageSummaryTable.url, crawledPageUrl))
      .orderBy(desc(pageSummaryTable.createdAt))
      .then(takeFirst);

    if (!pageSummary) {
      throw new Error(`Page summary for url: ${crawledPageUrl} not found`);
    }

    // generate branch predictions
    const branchPredictions = await LLMService.generateMessage({
      prompt: `You are an expert at generating thought-provoking follow-up questions and exploration paths based on content summaries.

You are given the context of previous nodes in a thinking tree, along with a page summary.

<previous-context>
${context}
</previous-context>

Based on the following page summary:

<page-summary>
URL: ${crawledPageUrl}
Gist: ${pageSummary.gist}
Key Points: ${pageSummary.keyPoints}
Detailed Summary: ${pageSummary.detailedSummary}
Mentioned Entities/Concepts: ${pageSummary.mentions}
</page-summary>

Generate 3-5 branch predictions that represent natural next questions or exploration paths a user might want to follow after reading this content.

GUIDELINES FOR GOOD BRANCH PREDICTIONS:
1. Each prediction should be a concise, specific question or exploration prompt (1-2 sentences)
2. Focus on extending the most interesting or complex ideas from the content
3. Include a mix of clarifying questions and expansions into related topics
4. Ensure predictions are directly relevant to the content but explore new angles
5. Phrase predictions as questions or "How to..." statements that invite further exploration
6. Avoid overly general or obvious predictions
7. Each prediction should stand alone as a clear, self-contained prompt
8. Consider the previous context to avoid redundancy and build upon existing ideas
9. Each prediction should have a 'type' that indicates the best way to explore it:
   - 'text' for conceptual questions that can be answered with explanations
   - 'web' for questions that would benefit from web search for factual information
   - 'image' for concepts that would be better understood through visualization

Format your response as structured output with an array of prediction objects, each containing 'text' and 'type' fields.`,
      chatHistory: [],
      env,
      structuredOutput: {
        name: 'branchPredictions',
        schema: this.branchPredictionsSchema,
      },
    });

    const typedResult = branchPredictions as z.infer<
      typeof this.branchPredictionsSchema
    >;

    return typedResult.predictions;
  },
};
