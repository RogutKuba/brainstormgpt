import { AppContext } from '..';
import OpenAI from 'openai';
import { ZodObject, ZodSchema } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

export const LLMService = {
  generateMessage: async (params: {
    prompt: string;
    chatHistory: {
      content: string;
      sender: 'user' | 'system';
    }[];
    env: AppContext['Bindings'];
    structuredOutput: {
      name: string;
      schema: ZodObject<any>;
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
      response_format: zodResponseFormat(
        structuredOutput.schema,
        structuredOutput.name
      ),
    });

    if (completion.choices[0].finish_reason === 'length') {
      // Handle the case where the model did not return a complete response
      throw new Error('Incomplete response');
    }

    const choice = completion.choices[0];

    console.log('choice', JSON.parse(choice.message.content!));

    if (structuredOutput) {
      // @ts-ignore
      return structuredOutput.schema.parse(JSON.parse(choice.message.content));
    }

    // Extract the response text
    return choice.message.content;
  },

  streamMessage: async (params: {
    prompt: string;
    chatHistory: {
      content: string;
      sender: 'user' | 'system';
    }[];
    env: AppContext['Bindings'];
    structuredOutput: {
      name: string;
      schema: ZodObject<any>;
    };
    onNewContent: (parsedContent: unknown) => void;
  }) => {
    const { prompt, chatHistory, env, structuredOutput, onNewContent } = params;

    // Initialize OpenAI client with API key from environment
    const openai = new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    });

    // const openai = new OpenAI({
    //   apiKey: env.OPENAI_API_KEY,
    // });

    const stream = openai.beta.chat.completions
      .stream({
        model: 'google/gemini-2.0-flash-001', // You can change this to other models like "gpt-4" if needed
        messages: [
          ...chatHistory.map((message) => ({
            role: message.sender,
            content: message.content,
          })),
          { role: 'user', content: prompt },
        ],
        response_format: zodResponseFormat(
          structuredOutput.schema,
          structuredOutput.name
        ),
      })
      .on('refusal.done', () => console.log('request refused'))
      .on('content.delta', ({ snapshot, parsed }) => {
        // console.log('content:', snapshot);
        // console.log('parsed:', parsed);
        onNewContent(parsed);
      })
      .on('content.done', (props) => {
        console.log(props);
      });

    await stream.done();

    const finalCompletion = await stream.finalChatCompletion();

    return finalCompletion;
  },
};
