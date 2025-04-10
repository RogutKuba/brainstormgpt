import { Context } from 'hono';
import { AppContext } from '..';
import { LLMService } from './LLM.service';
import { TLShapeId } from '@tldraw/tlschema';
import { TreeNode } from './Shape.service';
import { z } from 'zod';
import { StreamService } from './Stream.service';
import { generateTlShapeId } from '../lib/id';

export type BrainStormResult = {
  text: string;
  parentId?: TLShapeId; // Optional parent shape ID to connect to
  predictions?: string[]; // Added predictions field
};

const predictionNodeSchema = z.object({
  text: z.string(),
  type: z.enum(['text', 'web']),
});

const brainstormNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  text: z.string(),
  parentId: z.string().nullable().optional(),
  predictions: z.array(predictionNodeSchema),
});

export const brainstormResultSchema = z.object({
  explanation: z.string(),
  nodes: z.array(brainstormNodeSchema),
});

export const brainstormStreamSchema = z
  .object({
    explanation: z.string(),
    nodes: z.array(brainstormNodeSchema.partial()),
  })
  .partial();

export const brainstormStreamResultSchema = z.object({
  explanation: z.string(),
  nodes: z.array(
    brainstormNodeSchema.extend({
      id: z.string().transform((str) => str as TLShapeId),
    })
  ),
});

export const BrainstormService = {
  // #########################################################
  // #########################################################
  // STREAMING VERSION
  // #########################################################
  // #########################################################

  streamBrainstorm: async (params: {
    prompt: string;
    chatHistory: {
      content: string;
      sender: 'user' | 'system';
    }[];
    tree: TreeNode[];
    formattedShapes: string;
    streamService: StreamService;
    ctx: Context<AppContext>;
  }): Promise<z.infer<typeof brainstormStreamResultSchema>> => {
    const { prompt, chatHistory, streamService, tree, ctx, formattedShapes } =
      params;
    const encoder = new TextEncoder();

    // Find the deepest level in the tree
    const findDeepestLevel = (nodes: TreeNode[], currentLevel = 1): number => {
      if (nodes.length === 0) return currentLevel - 1;

      const childLevels = nodes.map((node) =>
        findDeepestLevel(node.children, currentLevel + 1)
      );

      return Math.max(currentLevel, ...childLevels);
    };

    const deepestLevel = findDeepestLevel(tree);

    // Find the IDs of shapes at the deepest level
    const findDeepestShapeIds = (
      nodes: TreeNode[],
      currentLevel = 1,
      targetLevel: number
    ): string[] => {
      if (currentLevel === targetLevel) {
        return nodes.map((node) => node.id);
      }

      return nodes.flatMap((node) =>
        findDeepestShapeIds(node.children, currentLevel + 1, targetLevel)
      );
    };

    const deepestShapeIds = findDeepestShapeIds(tree, 1, deepestLevel);

    // Send processing status
    streamService.streamController.enqueue(
      encoder.encode(
        'event: processing\ndata: {"status":"Generating ideas..."}\n\n'
      )
    );

    const response = await LLMService.streamMessage({
      prompt: `You are a professional whiteboard brainstorming assistant that helps users develop their ideas through structured, wiki-like content organization. You create concise, well-articulated nodes that function as interconnected knowledge units. You are given a user prompt and a list of current whiteboard nodes with their shape IDs and levels.
      
Based on these whiteboard nodes:

<existing-nodes>
${formattedShapes}
</existing-nodes>

<user-prompt>
${prompt}
</user-prompt>

First, provide a brief, professional explanation that summarizes the key insights and concepts you're adding. This should be conversational and helpful to the user, not a meta-description of the nodes themselves. Focus on the actual subject matter and insights rather than describing what you're doing.

IMPORTANT: When you see link nodes in the existing content, understand that users CANNOT see the content of these links directly on their whiteboard. The link summaries and key points are only visible to you as context. If you want to reference information from links, you should include that information explicitly in your new nodes.

PRIORITIZE extending the DEEPEST level of thinking in the existing nodes (level ${deepestLevel}). This should be your primary focus.

However, if you identify a significant gap in the knowledge structure that requires a new top-level or mid-level concept, you may suggest such additions when clearly justified.

IMPORTANT FORMATTING GUIDELINES:
1. Create CONCISE nodes that spark curiosity rather than exhaustive explanations
2. Each node should be a brief introduction to a concept (like a Wikipedia preview, not the full article)
3. Format each node with 1-2 clear, descriptive paragraphs. Dont include the title in the text, it should be in the title field.
4. Use proper markdown formatting with headings (###) for subtitles, etc.
5. Write in a professional, objective tone appropriate for knowledge documentation
6. Aim for 2-4 sentences per node - be concise and thought-provoking
7. Focus on introducing key ideas that encourage further exploration
8. Avoid lengthy explanations - the goal is to spark curiosity, not provide comprehensive coverage
9. Use bullet points sparingly and only for very brief lists

For each node, include 3-5 predictions of follow-up questions or exploration paths. Each prediction must have:
1. A 'text' field with the question or exploration prompt
2. A 'type' field that must be one of:
   - 'text': For questions that can be answered with text-based explanations
   - 'web': For questions that would benefit from web search to find current or factual information

PREDICTION TYPE GUIDELINES:
- PRIORITIZE 'text' type predictions (aim for at least 2-3 text predictions per node)
- Use 'text' for conceptual questions, explanations, theoretical discussions, and most follow-up questions
- Use 'web' sparingly and only when truly necessary for fact-checking, current events, statistics, or when external sources would be clearly valuable

For extending existing ideas, use parent IDs from this list of deepest shapes: ${deepestShapeIds.join(
        ', '
      )}

Your goal is to create a network of concise, intriguing knowledge nodes that prompt further thinking and exploration. Think of each node as a conversation starter rather than a complete explanation.`,
      chatHistory,
      env: ctx.env,
      structuredOutput: {
        name: 'brainstormStream',
        schema: brainstormStreamSchema,
      },
      onNewContent: (parsedContent) =>
        BrainstormService.handleStreamContent({
          streamService,
          parsedContent,
        }),
    });

    // Send complete message with the final result
    if (response.choices.length > 0 && response.choices[0].message.content) {
      const finalContent = JSON.parse(response.choices[0].message.content);
      const rawStreamResult = brainstormStreamSchema.parse(finalContent);

      const formattedStreamResult = {
        explanation: rawStreamResult.explanation ?? '',
        nodes: (rawStreamResult.nodes ?? []).map((node, index) => {
          const prevNodeInfo = streamService.getPrevNodeInfo(index);
          const nodeId = prevNodeInfo?.id ?? generateTlShapeId();
          return {
            id: nodeId,
            type: node.type ?? 'text',
            title: node.title ?? '',
            text: node.text ?? '',
            parentId: node.parentId ?? null,
            predictions: node.predictions ?? [],
          };
        }),
      };

      return formattedStreamResult;
    } else {
      throw new Error('No final response from LLM');
    }
  },

  handleStreamContent: async (params: {
    streamService: StreamService;
    parsedContent: unknown;
  }) => {
    const { streamService, parsedContent } = params;

    const { data, error } = brainstormStreamSchema
      .partial()
      .safeParse(parsedContent);

    if (error) {
      console.error(
        'Error parsing content:',
        parsedContent,
        error?.errors.map((e) => `${e.path}: ${e.message}`)
      );
      return;
    }

    if (data) {
      const { explanation, nodes } = data;

      streamService.handleExplanation(explanation);
      streamService.handleNodes(nodes);
    }
  },

  // #########################################################
  // #########################################################
  // WEB SEARCH VERSION
  // #########################################################
  // #########################################################

  streamWebSearch: async (params: {
    prompt: string;
    chatHistory: {
      content: string;
      sender: 'user' | 'system';
    }[];
    parentId: TLShapeId;
    tree: TreeNode[];
    formattedShapes: string;
    streamService: StreamService;
    ctx: Context<AppContext>;
  }): Promise<z.infer<typeof brainstormStreamResultSchema>> => {
    const {
      prompt,
      chatHistory,
      streamService,
      tree,
      ctx,
      parentId,
      formattedShapes,
    } = params;
    const encoder = new TextEncoder();

    // Find the deepest level in the tree
    const findDeepestLevel = (nodes: TreeNode[], currentLevel = 1): number => {
      if (nodes.length === 0) return currentLevel - 1;

      const childLevels = nodes.map((node) =>
        findDeepestLevel(node.children, currentLevel + 1)
      );

      return Math.max(currentLevel, ...childLevels);
    };

    const deepestLevel = findDeepestLevel(tree);

    // Find the IDs of shapes at the deepest level
    const findDeepestShapeIds = (
      nodes: TreeNode[],
      currentLevel = 1,
      targetLevel: number
    ): string[] => {
      if (currentLevel === targetLevel) {
        return nodes.map((node) => node.id);
      }

      return nodes.flatMap((node) =>
        findDeepestShapeIds(node.children, currentLevel + 1, targetLevel)
      );
    };

    // Send processing status
    streamService.streamController.enqueue(
      encoder.encode(
        'event: processing\ndata: {"status":"Searching the web..."}\n\n'
      )
    );

    let response;

    const totalPrompt = `You are a professional whiteboard brainstorming assistant that helps users develop their ideas through structured, wiki-like content organization. You create concise, well-articulated nodes that function as interconnected knowledge units. You are given a user prompt and a list of current whiteboard nodes with their shape IDs and levels.
Based on these whiteboard nodes:
<existing-nodes>
${formattedShapes}
</existing-nodes>

<user-prompt>
${prompt}
</user-prompt>

First, provide a brief, professional explanation that summarizes what you found from web search and how it relates to the user's query. This should be conversational and helpful to the user, not a meta-description of the search process.
IMPORTANT: When you see link nodes in the existing content, understand that users CANNOT see the content of these links directly on their whiteboard. The link summaries and key points are only visible to you as context. If you want to reference information from links, you should include that information explicitly in your new nodes.
PRIORITIZE extending the DEEPEST level of thinking in the existing nodes (level ${deepestLevel}). This should be your primary focus.

Your response must be structured in the following format:

<explanation>A brief explanation of what you found and how it relates to the user's query</explanation>

<title>Clear Descriptive Title</title>

<node>
Your comprehensive, factual answer based on web search results. Synthesize information from multiple sources.
Include specific facts, figures, and data points when relevant. Be objective and balanced.
Aim for 4-6 sentences total in markdown format (you can include subheadings and lists, but only h4 and h5). Be concise but informative.
</node>

<predictions>
- text|How does this concept relate to [related concept]?
- web|What are the latest developments in this area?
</predictions>

IMPORTANT: 
1. Do not include citation numbers like [1] or [2] in your response. Instead, incorporate the information naturally into your text.
2. Make sure to wrap each section in the appropriate XML tags as shown above.`;

    try {
      response = await LLMService.streamWebSearch({
        prompt: totalPrompt,
        chatHistory,
        env: ctx.env,
        onNewContent: async (answerContent) => {
          await streamService.handleWebSearchContent({
            answerContent,
            parentId,
          });
        },
      });
    } catch (error) {
      console.error('Error in streamWebSearch:', error);

      // Return a graceful error message as a node
      return {
        explanation:
          "I encountered an issue while searching the web. Here's what I could find:",
        nodes: [],
      };
    }

    // Create a formatted result with a single main node
    const mainNodeId =
      streamService.getPrevNodeInfo(0)?.id ?? generateTlShapeId();

    // Handle the case where response might be undefined or malformed
    // @ts-ignore
    const citations: string[] = response?.citations ?? [];

    // Extract content from the response
    let explanation = '';
    let answerText = '';
    let predictions: Array<{ text: string; type: 'text' | 'web' }> = [];

    if (
      response?.choices?.length > 0 &&
      response.choices[0]?.message?.content
    ) {
      const content = response.choices[0].message.content;

      // Extract explanation
      const explanationMatch = content.match(
        /<explanation>(.*?)<\/explanation>/s
      );
      if (explanationMatch && explanationMatch[1]) {
        explanation = explanationMatch[1].trim();
      }

      // Extract answer from node tag
      const nodeMatch = content.match(/<node>(.*?)<\/node>/s);
      if (nodeMatch && nodeMatch[1]) {
        answerText = nodeMatch[1].trim();
      } else {
        // If no answer tags, use the whole content as the answer
        answerText = content;
      }

      // Extract predictions
      const predictionsMatch = content.match(
        /<predictions>(.*?)<\/predictions>/s
      );
      if (predictionsMatch && predictionsMatch[1]) {
        const predictionLines = predictionsMatch[1].trim().split('\n');

        predictions = predictionLines
          .filter((line) => line.trim().startsWith('-'))
          .map((line) => {
            const cleanLine = line.trim().substring(1).trim();
            const parts = cleanLine.split('|');

            return {
              text: parts[0].trim(),
              type: (parts[1]?.trim() || 'text') as 'text' | 'web',
            };
          });
      }
    } else {
      // Fallback if we have a response but it's malformed
      answerText =
        "## Web Search Results\n\nI found some information but couldn't format it properly. You might want to try a more specific search.";

      // Add some default predictions
      predictions = [
        { text: 'Can you try a more specific search?', type: 'web' },
        { text: 'What exactly are you looking for?', type: 'text' },
      ];
    }

    // Create a formatted result with the main node
    const formattedStreamResult = {
      explanation: explanation || "Here's what I found from searching the web:",
      nodes: [
        {
          id: mainNodeId,
          type: 'text',
          title: 'Web Search Results',
          text:
            answerText ||
            'No specific results found. Try refining your search.',
          parentId,
          predictions,
        },
        ...BrainstormService.handleWebSearchCitations({
          citations: citations.slice(0, 3),
          parentId: mainNodeId,
        }),
      ],
    };

    return formattedStreamResult;
  },

  handleWebSearchCitations: (params: {
    citations: string[];
    parentId: TLShapeId;
  }): z.infer<typeof brainstormStreamResultSchema>['nodes'] => {
    const { citations, parentId } = params;

    return citations.map((citation) => ({
      id: generateTlShapeId(),
      type: 'link',
      text: citation,
      title: citation,
      parentId,
      predictions: [],
    }));
  },

  // #########################################################
  // #########################################################
  // PREDICTION GENERATION (NON-STREAMING)
  // #########################################################
  // #########################################################

  // You could also add a version that takes a shape or node content as context
  generatePredictions: async (params: {
    prompt: string;
    nodeContent: string;
    chatHistory: {
      content: string;
      sender: 'user' | 'system';
    }[];
    ctx: Context<AppContext>;
  }): Promise<Array<{ text: string; type: 'text' | 'web' }>> => {
    const { prompt, nodeContent, chatHistory, ctx } = params;

    try {
      const response = await LLMService.generateMessage({
        prompt: `You are an expert at generating thought-provoking follow-up questions and exploration paths based on content.

Based on the user prompt:

<user-prompt>
${prompt}
</user-prompt>

Generate 3-5 predictions that represent natural next questions or exploration paths a user might want to follow.

GUIDELINES FOR GOOD PREDICTIONS:
1. Each prediction should be a concise, specific question or exploration prompt (1-2 sentences)
2. Focus on extending the most interesting or complex ideas from the content
3. Include a mix of clarifying questions and expansions into related topics
4. Ensure predictions are directly relevant to the content but explore new angles
5. Phrase predictions as questions or "How to..." statements that invite further exploration
6. Avoid overly general or obvious predictions
7. Each prediction should stand alone as a clear, self-contained prompt
8. Each prediction should have a 'type' that indicates the best way to explore it:
   - 'text' for conceptual questions that can be answered with explanations (use this for most conceptual questions)
   - 'web' for questions that would benefit from web search for factual information (use sparingly, only for fact-checking)

Format your response as structured output with an array of prediction objects, each containing 'text' and 'type' fields.`,
        chatHistory,
        env: ctx.env,
        structuredOutput: {
          name: 'predictions',
          schema: z.object({
            predictions: z.array(
              z.object({
                text: z.string(),
                type: z.enum(['text', 'web']),
              })
            ),
          }),
        },
      });

      // Type assertion for the response
      const typedResponse = response as {
        predictions: Array<{ text: string; type: 'text' | 'web' }>;
      };

      return typedResponse.predictions || [];
    } catch (error) {
      console.error('Error generating predictions with context:', error);
      // Return some default predictions in case of error
      return [
        { text: 'Can you elaborate on this concept?', type: 'text' },
        { text: 'What are the practical applications of this?', type: 'text' },
        { text: 'Are there any recent studies on this topic?', type: 'web' },
      ];
    }
  },
};
