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
    shapes: TLShape[];
    ctx: Context<AppContext>;
  }): Promise<BrainStormResult[]> => {
    const { prompt, shapes, ctx } = params;

    console.log('shapes', shapes);

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
      prompt: `You are a whiteboard brainstorming assistant that helps users develop their ideas through iterative thinking. You are given a user prompt and a list of current whiteboard bubbles with their shape IDs.
      
Based on these whiteboard bubbles:

<existing-bubbles>
${formattedShapes}
</existing-bubbles>

<user-prompt>
${prompt}
</user-prompt>

Generate new whiteboard bubbles that represent the next iteration of thinking. Each new bubble should advance the brainstorming process by introducing new perspectives or directions to explore.

Format your response as:
<bubble parent="shape-id-1">Bubble content1</bubble>
<bubble parent="shape-id-2">Bubble content 2</bubble>

Only use parent attributes for bubbles that directly relate to an existing shape. Focus on advancing the overall brainstorming process rather than drilling down into specifics. You should be aiding in the creative process, not just generating ideas.`,
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
