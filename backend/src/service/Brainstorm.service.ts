import { Context } from 'hono';
import { AppContext } from '..';
import { LLMService } from './LLM.service';
import { TLGeoShape, TLShape, TLTextShape } from '@tldraw/tlschema';

type BrainStormResult =
  | {
      type: 'add-shape';
    }
  | {
      type: 'add-text';
      text: string;
    };

export const BrainstormService = {
  generateBrainstorm: async (params: {
    prompt: string;
    shapes: TLShape[];
    ctx: Context<AppContext>;
  }): Promise<BrainStormResult[]> => {
    const { prompt, shapes, ctx } = params;

    // from all shapes, extract all the text content
    const textFromShapes = (() => {
      const textShapes = shapes.filter(
        (shape) => shape.type === 'text'
      ) as TLTextShape[];

      return textShapes.map((shape) => shape.props.text?.trim() ?? '');
    })();

    const newIdeaResult = await LLMService.generateMessage({
      prompt: `You are a brainstorming assistant. You are given a prompt and a list of ideas. You need to expand on the prompt based on the ideas. Based on these ideas: <idea-list>${textFromShapes.join(
        '\n'
      )}</idea-list>. ${prompt}`,
      ctx,
    });

    if (!newIdeaResult) {
      throw new Error('No response from LLM');
    }

    // for now just add shape and text result
    const result: BrainStormResult[] = [
      {
        type: 'add-text',
        text: newIdeaResult,
      },
      {
        type: 'add-shape',
      },
    ];

    return result;
  },
};
