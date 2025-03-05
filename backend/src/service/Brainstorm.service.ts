import { Context } from 'hono';
import { AppContext } from '..';
import { LLMService } from './LLM.service';
import { TLGeoShape, TLShape, TLTextShape } from '@tldraw/tlschema';

type BrainStormResult = {
  type: 'add-text';
  text: string;
  parentId?: string; // Optional parent shape ID to connect to
};

export const BrainstormService = {
  generateBrainstorm: async (params: {
    prompt: string;
    goal?: string;
    shapes: TLShape[];
    ctx: Context<AppContext>;
  }): Promise<BrainStormResult[]> => {
    const { prompt, shapes, ctx, goal } = params;

    return [];

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

Generate new whiteboard bubbles that represent the next iteration of thinking. Each new bubble should be concise and formatted as a brief idea unless the user specifically requests detailed explanations.

Format your response as:
<bubble parent="shape-id-1">Key idea 1</bubble>
<bubble parent="shape-id-2">Key idea 2</bubble>

Only use parent attributes for bubbles that directly relate to an existing shape. Focus on advancing the overall brainstorming process with concise, actionable ideas. Keep each bubble brief.`,
      ctx,
    });

    if (!newIdeasResult) {
      throw new Error('No response from LLM');
    }

    // Parse the LLM response to extract bubbles and their parent relationships
    const results: BrainStormResult[] = [];

    // Simple regex to extract bubbles and their parents
    const bubbleRegex = /<bubble(?:\s+parent="([^"]+)")?>([^<]+)<\/bubble>/g;
    let match;

    while ((match = bubbleRegex.exec(newIdeasResult)) !== null) {
      const parentId = match[1]; // This will be undefined for bubbles without parents
      const text = match[2].trim();

      results.push({
        type: 'add-text',
        text,
        ...(parentId && { parentId }),
      });
    }

    // If no ideas were extracted using the regex, fall back to using the whole response
    if (results.length === 0) {
      results.push({
        type: 'add-text',
        text: newIdeasResult,
      });
    }

    return results;
  },
};
