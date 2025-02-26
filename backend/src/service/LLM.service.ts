import { Context } from 'hono';
import { AppContext } from '..';
import OpenAI from 'openai';

export const LLMService = {
  generateMessage: async (params: {
    prompt: string;
    ctx: Context<AppContext>;
  }) => {
    const { prompt, ctx } = params;

    // Initialize OpenAI client with API key from environment
    const openai = new OpenAI({
      apiKey: ctx.env.OPENAI_API_KEY,
    });

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // You can change this to other models like "gpt-4" if needed
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract the response text
    const answer = response.choices[0]?.message?.content;

    if (!answer) {
      throw new Error('Received no response from LLM');
    }

    return answer;
  },
};
