import { Context } from 'hono';
import { AppContext } from '..';
import OpenAI from 'openai';

export const LLMService = {
  generateMessage: async (params: {
    prompt: string;
    chatHistory: {
      content: string;
      sender: 'user' | 'system';
    }[];
    env: AppContext['Bindings'];
  }) => {
    const { prompt, chatHistory, env } = params;

    // Initialize OpenAI client with API key from environment
    const openai = new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'google/gemini-2.0-flash-001', // You can change this to other models like "gpt-4" if needed
      messages: [
        ...chatHistory.map((message) => ({
          role: message.sender,
          content: message.content,
        })),
        { role: 'user', content: prompt },
      ],
    });

    // Extract the response text
    const answer = response.choices[0]?.message?.content;

    if (!answer) {
      throw new Error('Received no response from LLM');
    }

    return answer;
  },
};
