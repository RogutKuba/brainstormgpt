import { Context } from 'hono';
import { AppContext } from '..';
import { LLMService } from './LLM.service';
import { TLShapeId } from '@tldraw/tlschema';
import { TreeNode } from './Shape.service';
import { PageSummaryEntity, pageSummaryTable } from '../db/pageSummary.db';
import { inArray } from 'drizzle-orm';
import { getDbConnection } from '../db/client';
import { z } from 'zod';
import { ReadableStreamController } from 'stream/web';
import { StreamService } from './Stream.service';

export type BrainStormResult = {
  text: string;
  parentId?: TLShapeId; // Optional parent shape ID to connect to
  predictions?: string[]; // Added predictions field
};

// Helper function to extract shapes with text from the tree structure
async function extractShapesWithText(params: {
  tree: TreeNode[];
  ctx: Context<AppContext>;
}): Promise<string> {
  const { tree, ctx } = params;

  /*
  the result of the function should be a string that contains the shapes with text
  the format of the string should be:
  <node id="shape-id-1" level="1">shape-text-1</node>
    <node id="shape-id-2" level="2" parent="shape-id-1">shape-text-2</node>
    <node id="shape-id-3" level="2" parent="shape-id-1">shape-text-3</node>
  ...
  */

  /**
   * Start by extracting all text out of nodes, then process link nodes in batch
   * to avoid multiple database queries
   */

  // First pass: collect all nodes and identify link nodes
  const allNodes: ({
    id: string;
    level: number;
    parentId?: string;
  } & (
    | {
        type: 'text' | 'rich-text';
        text: string;
      }
    | { type: 'link'; url: string }
  ))[] = [];

  function collectNodes(
    node: TreeNode,
    level: number,
    parentId?: string
  ): void {
    if (node.type === 'text' || node.type === 'rich-text') {
      allNodes.push({
        id: node.id,
        level,
        parentId,
        type: 'text',
        text: node.text,
      });
    } else if (node.type === 'link') {
      allNodes.push({
        id: node.id,
        level,
        parentId,
        type: 'link',
        url: node.url,
      });
    }

    // Process children recursively
    node.children.forEach((child) => collectNodes(child, level + 1, node.id));
  }

  // Collect all nodes
  tree.forEach((node) => collectNodes(node, 1));

  // Extract all unique URLs from link nodes
  const linkNodes = allNodes.filter((node) => node.type === 'link');
  const uniqueUrls = [...new Set(linkNodes.map((node) => node.url))];

  // If we have link nodes, fetch all summaries in a single query
  let urlToSummaryMap = new Map<string, PageSummaryEntity>();

  // This would be an async function in practice, but we're keeping the original function signature
  // In a real implementation, you'd need to make this function async or use a different pattern
  if (uniqueUrls.length > 0) {
    // This is a placeholder for the actual DB query
    // In a real implementation, you would:
    // 1. Get DB connection
    // 2. Query all summaries for the unique URLs in one go
    // 3. Map the results by URL for easy lookup
    const db = getDbConnection(ctx);
    const summaries = await db
      .select()
      .from(pageSummaryTable)
      .where(inArray(pageSummaryTable.url, uniqueUrls));

    summaries.forEach((summary) => {
      urlToSummaryMap.set(summary.url, summary);
    });
  }

  // Second pass: generate the final output string with all nodes in the original order
  function processNode(node: {
    id: string;
    level: number;
    parentId?: string;
    type: 'text' | 'link' | 'rich-text';
    text?: string;
    url?: string;
  }): string {
    const parentAttr = node.parentId ? ` parent="${node.parentId}"` : '';
    let nodeText = '';

    if (node.type === 'text') {
      nodeText = node.text || '';
    } else if (node.type === 'link') {
      // For link nodes, use the summary if available
      const summary = urlToSummaryMap.get(node.url || '');
      if (summary) {
        nodeText = `${summary.gist}\n\n${summary.keyPoints}`;
      } else {
        nodeText = `Link: ${node.url}`;
      }
    }

    return `<node id="${node.id}" level="${node.level}"${parentAttr}>${nodeText}</node>`;
  }

  // Generate the final output by processing each node in the original order
  return allNodes
    .sort((a, b) => {
      // Sort by level first, then by original order
      if (a.level !== b.level) return a.level - b.level;
      // Use the original index in the allNodes array as a proxy for original order
      return allNodes.indexOf(a) - allNodes.indexOf(b);
    })
    .map(processNode)
    .join('\n');
}

export const brainstormResultSchema = z.object({
  explanation: z.string(),
  nodes: z.array(
    z.object({
      type: z.string(),
      text: z.string(),
      parentId: z.string().optional(),
      // predictions: z.array(z.string()),
    })
  ),
});

const brainstormStreamSchema = z
  .object({
    explanation: z.string(),
    nodes: z.array(
      z.object({
        type: z.string(),
        text: z.string(),
        parentId: z.string().nullable(),
        predictions: z.array(z.string()),
      })
    ),
  })
  .partial();

export const BrainstormService = {
  generateBrainstorm: async (params: {
    prompt: string;
    chatHistory: {
      content: string;
      sender: 'user' | 'system';
    }[];
    goal?: string;
    tree: TreeNode[];
    ctx: Context<AppContext>;
  }): Promise<{
    newNodes: BrainStormResult[];
    explanation: string;
    deepestLevel: number;
  }> => {
    const { prompt, tree, ctx, goal, chatHistory } = params;

    const formattedShapes = await extractShapesWithText({ tree, ctx });

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

    // console.log('formattedShapes', formattedShapes);
    // console.log('deepest level:', deepestLevel);
    // console.log('deepest shape IDs:', deepestShapeIds);

    const newIdeasResult = await LLMService.generateMessage({
      prompt: `You are a professional whiteboard brainstorming assistant that helps users develop their ideas through structured, wiki-like content organization. You create concise, well-articulated nodes that function as interconnected knowledge units. You are given a user prompt and a list of current whiteboard nodes with their shape IDs and levels.
      
Based on these whiteboard nodes:

<existing-nodes>
${formattedShapes}
</existing-nodes>

<user-prompt>
${prompt}
</user-prompt>
${
  goal
    ? `
<brainstorming-goal>
${goal}
</brainstorming-goal>`
    : ''
}

First, provide a brief, professional explanation of your new content elements. Focus on logical relationships and conceptual connections.

IMPORTANT: When you see link nodes in the existing content, understand that users CANNOT see the content of these links directly on their whiteboard. The link summaries and key points are only visible to you as context. If you want to reference information from links, you should include that information explicitly in your new nodes.

PRIORITIZE extending the DEEPEST level of thinking in the existing nodes (level ${deepestLevel}). This should be your primary focus.

However, if you identify a significant gap in the knowledge structure that requires a new top-level or mid-level concept, you may suggest such additions when clearly justified.

IMPORTANT FORMATTING GUIDELINES:
1. Create each node as a self-contained, wiki-like knowledge unit focused on ONE specific concept
2. Format each node with a clear, descriptive title followed by comprehensive content
3. Use proper markdown formatting with headings (##) for titles
4. Write in a professional, objective tone appropriate for knowledge documentation
5. Ensure each node can stand alone while also connecting to the broader knowledge structure
6. Break content into SHORT PARAGRAPHS of 2-3 sentences each for easy readability
7. Use bullet points only when presenting lists of specific items
8. Maintain consistent terminology and reference style across all nodes
9. Avoid large blocks of text - aim for visual clarity with frequent paragraph breaks

For each node, also include 2-3 predictions of follow-up questions the user might ask about this specific node. These should be natural extensions of the node's content.

For extending existing ideas, use parent IDs from this list of deepest shapes: ${deepestShapeIds.join(
        ', '
      )}

Your goal is to create a cohesive knowledge structure where each node functions as its own mini-wiki article - self-contained yet connected to the broader context. Prioritize clarity, precision, and professional tone throughout. Remember to keep paragraphs SHORT (2-3 sentences) for optimal readability on a whiteboard.`,
      chatHistory,
      env: ctx.env,
      structuredOutput: {
        name: 'brainstormResult',
        schema: brainstormResultSchema,
      },
    });

    if (!newIdeasResult) {
      throw new Error('No response from LLM');
    }

    // Since we're using structured output, we can directly use the parsed result
    const typedResult = newIdeasResult as z.infer<
      typeof brainstormResultSchema
    >;

    // Map the structured output to our expected return format
    const results: BrainStormResult[] = typedResult.nodes.map((node) => ({
      type: 'add-text',
      text: node.text,
      ...(node.parentId && { parentId: node.parentId as TLShapeId }),
      predictions: [],
    }));

    return {
      newNodes: results,
      deepestLevel,
      explanation: typedResult.explanation,
    };
  },

  streamBrainstorm: async (params: {
    prompt: string;
    chatHistory: {
      content: string;
      sender: 'user' | 'system';
    }[];
    tree: TreeNode[];
    streamController: ReadableStreamController<any>;
    ctx: Context<AppContext>;
  }) => {
    const { prompt, chatHistory, streamController, tree, ctx } = params;
    const encoder = new TextEncoder();

    // Track the accumulated explanation to avoid duplicating content
    let accumulatedExplanation = '';
    let lastSentExplanationLength = 0;

    // Track accumulated nodes to avoid duplicating
    let accumulatedNodes: {
      id: string;
      type: string;
      text: string;
      parentId?: string;
      predictions?: string[];
    }[] = [];

    const formattedShapes = await extractShapesWithText({ tree, ctx });

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

    const streamService = new StreamService(streamController);

    // Send processing status
    streamController.enqueue(
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

First, provide a brief, professional explanation of your new content elements. Focus on logical relationships and conceptual connections.

IMPORTANT: When you see link nodes in the existing content, understand that users CANNOT see the content of these links directly on their whiteboard. The link summaries and key points are only visible to you as context. If you want to reference information from links, you should include that information explicitly in your new nodes.

PRIORITIZE extending the DEEPEST level of thinking in the existing nodes (level ${deepestLevel}). This should be your primary focus.

However, if you identify a significant gap in the knowledge structure that requires a new top-level or mid-level concept, you may suggest such additions when clearly justified.

IMPORTANT FORMATTING GUIDELINES:
1. Create each node as a self-contained, wiki-like knowledge unit focused on ONE specific concept
2. Format each node with a clear, descriptive title followed by comprehensive content
3. Use proper markdown formatting with headings (##) for titles
4. Write in a professional, objective tone appropriate for knowledge documentation
5. Ensure each node can stand alone while also connecting to the broader knowledge structure
6. Break content into SHORT PARAGRAPHS of 2-3 sentences each for easy readability
7. Use bullet points only when presenting lists of specific items
8. Maintain consistent terminology and reference style across all nodes
9. Avoid large blocks of text - aim for visual clarity with frequent paragraph breaks

For each node, also include 2-3 predictions of follow-up questions the user might ask about this specific node. These should be natural extensions of the node's content.

For extending existing ideas, use parent IDs from this list of deepest shapes: ${deepestShapeIds.join(
        ', '
      )}

Your goal is to create a cohesive knowledge structure where each node functions as its own mini-wiki article - self-contained yet connected to the broader context. Prioritize clarity, precision, and professional tone throughout. Remember to keep paragraphs SHORT (2-3 sentences) for optimal readability on a whiteboard.`,
      chatHistory,
      env: ctx.env,
      structuredOutput: {
        name: 'brainstormResult',
        schema: brainstormResultSchema,
      },
      onNewContent: (parsedContent) =>
        BrainstormService.handleStreamContent({
          streamService,
          parsedContent,
        }),
    });
    // const { data, error } = brainstormResultSchema
    //   .partial()
    //   .safeParse(parsedContent);

    // if (error) {
    //   console.error('Error parsing content:', parsedContent);
    //   return;
    // }

    // if (data) {
    //   // Handle explanation streaming
    //   if (data.explanation) {
    //     const newExplanation = data.explanation;

    //     if (newExplanation.length > accumulatedExplanation.length) {
    //       // Get only the new part of the explanation
    //       const newChunk = newExplanation.substring(
    //         lastSentExplanationLength
    //       );

    //       if (newChunk.trim()) {
    //         // Send the new chunk to the client
    //         streamController.enqueue(
    //           encoder.encode(
    //             `event: chunk\ndata: ${JSON.stringify({
    //               chunk: newChunk,
    //             })}\n\n`
    //           )
    //         );

    //         // Update tracking variables
    //         accumulatedExplanation = newExplanation;
    //         lastSentExplanationLength = newExplanation.length;
    //       }
    //     }
    //   }

    //   // Handle nodes streaming
    //   if (data.nodes && data.nodes.length > 0) {
    //     // Process only new nodes that haven't been sent yet
    //     const newNodes = data.nodes.slice(accumulatedNodes.length);

    //     if (newNodes.length > 0) {
    //       // Generate consistent IDs for new nodes
    //       const nodesWithIds = newNodes.map((node, index) => {
    //         // Create a deterministic ID based on the node's index in the overall array
    //         const nodeId = `shape:${crypto.randomUUID()}` as TLShapeId;

    //         // if parentId is 'none', set to undefined
    //         const parentId =
    //           node.parentId === 'none' ? undefined : node.parentId;

    //         return {
    //           id: nodeId,
    //           type: node.type,
    //           text: node.text,
    //           parentId: parentId as TLShapeId | undefined,
    //           predictions: node.predictions || [],
    //         };
    //       });

    //       // Add to accumulated nodes
    //       accumulatedNodes = [...accumulatedNodes, ...nodesWithIds];

    //       // Send the new nodes to the client
    //       streamController.enqueue(
    //         encoder.encode(
    //           `event: nodes\ndata: ${JSON.stringify({
    //             nodes: nodesWithIds,
    //           })}\n\n`
    //         )
    //       );
    //     }
    //   }
    //     }
    //   },
    // });

    // Send complete message with the final result
    if (response.choices[0].message.content) {
      try {
        const finalContent = JSON.parse(response.choices[0].message.content);
        const validatedResult = brainstormResultSchema.parse(finalContent);

        // Generate final IDs for any nodes that weren't streamed yet
        const finalNodes = validatedResult.nodes.map((node, index) => {
          // If we already have this node in accumulated nodes, use that ID
          if (index < accumulatedNodes.length) {
            return accumulatedNodes[index];
          }

          // Otherwise generate a new ID
          const nodeId = `shape:${crypto.randomUUID()}` as TLShapeId;
          return {
            id: nodeId,
            type: node.type,
            text: node.text,
            parentId: node.parentId as TLShapeId | undefined,
            predictions: [],
          };
        });

        // Send the complete message
        streamController.enqueue(
          encoder.encode(
            `event: complete\ndata: ${JSON.stringify({
              message: validatedResult.explanation,
              nodes: finalNodes,
            })}\n\n`
          )
        );
      } catch (error) {
        console.error(
          'Error parsing final content:',
          response.choices[0].message.content
        );
        streamController.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({
              error: 'Failed to parse final content',
            })}\n\n`
          )
        );
      }
    }

    return response;
  },

  handleStreamContent: async (params: {
    streamService: StreamService;
    parsedContent: unknown;
  }) => {
    const { streamService, parsedContent } = params;

    const { data, error } = brainstormResultSchema
      .partial()
      .safeParse(parsedContent);

    if (error) {
      return;
    }

    if (data) {
      const { explanation, nodes } = data;

      streamService.handleExplanation(explanation);
      streamService.handleNodes(nodes);
    }
  },
};
