import { z } from '@hono/zod-openapi';

export const ErrorResponses = {
  400: {
    description: 'Returns error message',
    content: {
      'text/plain': {
        schema: z.string(),
      },
    },
  },
  401: {
    description: 'Returns error message',
    content: {
      'text/plain': {
        schema: z.string(),
      },
    },
  },
  403: {
    description: 'Returns error message',
    content: {
      'text/plain': {
        schema: z.string(),
      },
    },
  },
  404: {
    description: 'Returns error message',
    content: {
      'text/plain': {
        schema: z.string(),
      },
    },
  },
  500: {
    description: 'Returns error message',
    content: {
      'text/plain': {
        schema: z.string(),
      },
    },
  },
};
