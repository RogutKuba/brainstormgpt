import { Context } from 'hono';
import { AppContext } from '..';
import { LLMService } from './LLM.service';
import { TLShapeId } from '@tldraw/tlschema';
import { TreeNode } from './Shape.service';
import { PageSummaryEntity, pageSummaryTable } from '../db/pageSummary.db';
import { inArray } from 'drizzle-orm';
import { getDbConnection } from '../db/client';

type BrainStormResult = {
  type: 'add-text';
  text: string;
  parentId?: TLShapeId; // Optional parent shape ID to connect to
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
    newShapes: BrainStormResult[];
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

First, provide a brief, professional explanation of how your new content elements connect to and extend the existing knowledge structure. Focus on logical relationships and conceptual connections.

IMPORTANT: When you see link nodes in the existing content, understand that users CANNOT see the content of these links directly on their whiteboard. The link summaries and key points are only visible to you as context. If you want to reference information from links, you should include that information explicitly in your new nodes.

PRIORITIZE extending the DEEPEST level of thinking in the existing nodes (level ${deepestLevel}). This should be your primary focus.

However, if you identify a significant gap in the knowledge structure that requires a new top-level or mid-level concept, you may suggest such additions when clearly justified.

IMPORTANT FORMATTING GUIDELINES:
1. Create each node as a self-contained, wiki-like knowledge unit focused on ONE specific concept
2. Format each node with a clear, descriptive title followed by comprehensive content
3. Use proper markdown formatting with headings (##) for titles
4. Write in a professional, objective tone appropriate for knowledge documentation
5. Ensure each node can stand alone while also connecting to the broader knowledge structure
6. Use paragraphs for narrative explanation and bullet points only when presenting lists of specific items
7. Maintain consistent terminology and reference style across all nodes

Format your response as:
<explanation>Professional overview of how these new knowledge units extend and complement the existing structure</explanation>
<node parent="shape-id-1">
## Descriptive Title for This Concept

Comprehensive explanation of this specific concept. Present information in a clear, objective manner that would be appropriate for a professional knowledge base or wiki article. Develop the concept with proper context and logical flow.
</node>
<node parent="shape-id-1">
## Different Concept Title

Another well-structured explanation that explores a different concept related to the same parent. Provide depth and precision rather than superficial coverage.
</node>
<node parent="shape-id-2">
## Another Specific Concept

Detailed explanation of this concept with appropriate professional terminology and structure.
</node>
<node>
## New Foundational Concept (only if addressing a significant gap)

Comprehensive explanation establishing this new concept within the broader knowledge structure.
</node>

For extending existing ideas, use parent IDs from this list of deepest shapes: ${deepestShapeIds.join(
        ', '
      )}

Your goal is to create a cohesive knowledge structure where each node functions as its own mini-wiki article - self-contained yet connected to the broader context. Prioritize clarity, precision, and professional tone throughout.`,
      chatHistory,
      env: ctx.env,
    });

    if (!newIdeasResult) {
      throw new Error('No response from LLM');
    }

    // console.log('newIdeasResult', newIdeasResult);

    // Parse the LLM response to extract nodes and their parent relationships
    const results: BrainStormResult[] = [];

    // Extract the explanation if present
    const explanationMatch = newIdeasResult.match(
      /<explanation>([^<]+)<\/explanation>/
    );

    // Simple regex to extract nodes and their parents
    const nodeRegex = /<node(?:\s+parent="([^"]+)")?>([^<]+)<\/node>/gs;
    let match;

    while ((match = nodeRegex.exec(newIdeasResult)) !== null) {
      const parentId = match[1]; // This will be undefined for nodes without parents
      const text = match[2].trim();

      results.push({
        type: 'add-text',
        text: text.trim(),
        ...(parentId && { parentId: parentId as TLShapeId }),
      });
    }

    // If no ideas were extracted using the regex, fall back to using the whole response
    if (results.length === 0) {
      results.push({
        type: 'add-text',
        text: newIdeasResult.trim(),
      });
    }

    return {
      newShapes: results,
      deepestLevel,
      explanation:
        explanationMatch?.[1].trim() ?? 'I generated some new ideas:',
    };
  },
};
