import { Context } from 'hono';
import { AppContext } from '..';
import { LLMService } from './LLM.service';
import { TLShapeId } from '@tldraw/tlschema';
import { TreeNode } from './Shape.service';

type BrainStormResult = {
  type: 'add-text';
  text: string;
  parentId?: TLShapeId; // Optional parent shape ID to connect to
};

// Helper function to extract shapes with text from the tree structure
function extractShapesWithText(tree: TreeNode[]): string {
  /*
  the result of the function should be a string that contains the shapes with text
  the format of the string should be:
  <bubble id="shape-id-1" level="1">shape-text-1</bubble>
    <bubble id="shape-id-2" level="2" parent="shape-id-1">shape-text-2</bubble>
    <bubble id="shape-id-3" level="2" parent="shape-id-1">shape-text-3</bubble>
  ...
  */

  function processNode(
    node: TreeNode,
    level: number,
    parentId?: string
  ): string {
    // const parentAttr = parentId ? ` parent="${parentId}"` : '';
    const currentNode = `<bubble id="${node.id}" level="${level}">${node.text}</bubble>`;

    if (node.children.length === 0) {
      return currentNode;
    }

    const childrenText = node.children
      .map((child) => processNode(child, level + 1, node.id))
      .join('\n');

    return `${currentNode}\n${childrenText}`;
  }

  return tree.map((node) => processNode(node, 1)).join('\n');
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

    const formattedShapes = extractShapesWithText(tree);

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
      prompt: `You are a whiteboard brainstorming assistant that helps users develop their ideas through iterative thinking by giving unique and concise ideas. You are given a user prompt and a list of current whiteboard bubbles with their shape IDs and levels.
      
Based on these whiteboard bubbles:

<existing-bubbles>
${formattedShapes}
</existing-bubbles>

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

First, provide a brief explanation of how your new ideas connect to and extend the existing content. Focus on the relationships and connections between ideas, not on what you're doing.

PRIORITIZE extending the DEEPEST level of thinking in the existing bubbles (level ${deepestLevel}). This should be your primary focus.

However, if you believe a new top-level idea is truly valuable or if no existing content is provided, you may also suggest new top-level or mid-level ideas.

Format your response as:
<explanation>Brief overview of how these new ideas relate to and extend the existing content</explanation>
<bubble parent="shape-id-1">Key idea 1</bubble>
<bubble parent="shape-id-2">Key idea 2</bubble>
<bubble>New top-level idea</bubble> <!-- Only if truly valuable -->

For extending existing ideas, use parent IDs from this list of deepest shapes: ${deepestShapeIds.join(
        ', '
      )}

Keep each bubble brief and concise (5-15 words). Your goal is primarily to extend the existing deepest thoughts with specific, actionable, or insightful additions.`,
      chatHistory,
      ctx,
    });

    if (!newIdeasResult) {
      throw new Error('No response from LLM');
    }

    // Parse the LLM response to extract bubbles and their parent relationships
    const results: BrainStormResult[] = [];

    // Extract the explanation if present
    const explanationMatch = newIdeasResult.match(
      /<explanation>([^<]+)<\/explanation>/
    );

    // Simple regex to extract bubbles and their parents
    const bubbleRegex = /<bubble(?:\s+parent="([^"]+)")?>([^<]+)<\/bubble>/g;
    let match;

    while ((match = bubbleRegex.exec(newIdeasResult)) !== null) {
      const parentId = match[1]; // This will be undefined for bubbles without parents
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
