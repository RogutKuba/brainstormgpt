import { AppContext } from '..';
import OpenAI from 'openai';
import { ZodSchema } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

export const LLMService = {
  generateMessage: async (params: {
    prompt: string;
    chatHistory: {
      content: string;
      sender: 'user' | 'system';
    }[];
    env: AppContext['Bindings'];
    structuredOutput?: {
      name: string;
      schema: ZodSchema;
    };
  }) => {
    const { prompt, chatHistory, env, structuredOutput } = params;

    // Initialize OpenAI client with API key from environment
    const openai = new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'google/gemini-2.0-flash-001', // You can change this to other models like "gpt-4" if needed
      messages: [
        ...chatHistory.map((message) => ({
          role: message.sender,
          content: message.content,
        })),
        { role: 'user', content: prompt },
      ],
      response_format: structuredOutput
        ? zodResponseFormat(structuredOutput.schema, structuredOutput.name)
        : undefined,
    });

    if (completion.choices[0].finish_reason === 'length') {
      // Handle the case where the model did not return a complete response
      throw new Error('Incomplete response');
    }

    // Extract the response text
    const answer = completion.choices[0].message;

    if (structuredOutput) {
      return structuredOutput.schema.parse(answer);
    }

    return answer.content;
  },
};
