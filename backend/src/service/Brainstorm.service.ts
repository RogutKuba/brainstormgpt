import { Context } from 'hono';
import { AppContext } from '..';
import { LLMService } from './LLM.service';
import { TLGeoShape, TLShape, TLShapeId, TLTextShape } from '@tldraw/tlschema';

type BrainStormResult = {
  type: 'add-text';
  text: string;
  parentId?: TLShapeId; // Optional parent shape ID to connect to
};

export const BrainstormService = {
  generateBrainstorm: async (params: {
    prompt: string;
    chatHistory: {
      content: string;
      sender: 'user' | 'system';
    }[];
    goal?: string;
    shapes: TLShape[];
    ctx: Context<AppContext>;
  }): Promise<{
    newShapes: BrainStormResult[];
    explanation: string;
  }> => {
    const { prompt, shapes, ctx, goal, chatHistory } = params;

    console.log('params', {
      prompt,
      goal,
    });

    // Extract text content with shape IDs
    const shapesWithText = (() => {
      const textShapes = shapes.filter(
        (shape) => shape.type === 'text'
      ) as TLTextShape[];

      const geoShapesWithText = (
        shapes.filter((shape) => shape.type === 'geo') as TLGeoShape[]
      ).filter((shape) => shape.props.text?.length > 0);

      return [...textShapes, ...geoShapesWithText].map((shape) => ({
        id: shape.id,
        text: shape.props.text?.trim() ?? '',
      }));
    })();

    // Format shapes with text for the LLM prompt
    const formattedShapes = shapesWithText
      .map((shape) => `<shape id="${shape.id}">${shape.text}</shape>`)
      .join('\n');

    const newIdeasResult = await LLMService.generateMessage({
      prompt: `You are a whiteboard brainstorming assistant that helps users develop their ideas through iterative thinking by giving unique and concise ideas. You are given a user prompt and a list of current whiteboard bubbles with their shape IDs.
      
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

First, provide a brief explanation of what you're doing based on the user's prompt and existing content. Then, generate new whiteboard bubbles that represent the next iteration of thinking. Each new bubble should be concise and formatted as a brief idea unless the user specifically requests detailed explanations.

Format your response as:
<explanation>Brief overview of what you're doing and how these ideas connect to the user's prompt</explanation>
<bubble parent="shape-id-1">Key idea 1</bubble>
<bubble parent="shape-id-2">Key idea 2</bubble>

Only use parent attributes for bubbles that directly relate to an existing shape. Focus on advancing the overall brainstorming process with concise, actionable ideas. Keep each bubble brief.`,
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
      explanation:
        explanationMatch?.[1].trim() ?? 'I generated some new ideas:',
    };
  },
};
