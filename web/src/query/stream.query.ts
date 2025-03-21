import { useState } from 'react';

import { useCallback } from 'react';

export const useStreamMessage = () => {
  const [streamingState, setStreamingState] = useState<{
    isStreaming: boolean;
    chunks: string;
    status: string | null;
    error: string | null;
  }>({
    isStreaming: false,
    chunks: '',
    status: null,
    error: null,
  });

  const streamMessage = useCallback(
    async (params: {
      workspaceId: string;
      message: string;
      chatHistory: { content: string; sender: 'user' | 'system' }[];
      selectedItems: string[];
      predictionId: string | null;
      onChunk?: (chunk: string) => void;
      onStatus?: (status: string) => void;
      onComplete?: (message: string, nodes: string[]) => void;
      onError?: (error: string) => void;
    }) => {
      try {
        // Reset streaming state
        setStreamingState({
          isStreaming: true,
          chunks: '',
          status: null,
          error: null,
        });

        // Create the request URL
        const url = `/workspace/${params.workspaceId}/stream`;

        // Prepare the request
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || ''}${url}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: params.message,
              chatHistory: params.chatHistory,
              selectedItems: params.selectedItems,
              predictionId: params.predictionId,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }

        // Get the response body as a ReadableStream
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }

        // Create a text decoder to convert Uint8Array to string
        const decoder = new TextDecoder();
        let accumulatedChunks = '';

        // Process the stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Decode the chunk
          const chunk = decoder.decode(value, { stream: true });

          // Process SSE format (event: type\ndata: {...}\n\n)
          const events = chunk.split('\n\n').filter(Boolean);

          for (const event of events) {
            const [eventType, eventData] = event.split('\n');

            if (!eventType || !eventData) continue;

            const type = eventType.replace('event: ', '');
            const data = JSON.parse(eventData.replace('data: ', ''));

            switch (type) {
              case 'start':
                setStreamingState((prev) => ({
                  ...prev,
                  status: data.status,
                }));
                params.onStatus?.(data.status);
                break;

              case 'chunk':
                accumulatedChunks += data.chunk;
                setStreamingState((prev) => ({
                  ...prev,
                  chunks: accumulatedChunks,
                }));
                params.onChunk?.(data.chunk);
                break;

              case 'processing':
                setStreamingState((prev) => ({
                  ...prev,
                  status: data.status,
                }));
                params.onStatus?.(data.status);
                break;

              case 'complete':
                setStreamingState((prev) => ({
                  ...prev,
                  isStreaming: false,
                  status: 'complete',
                }));
                // The message now might include nodes data
                const completeData = {
                  message: data.message,
                  nodes: data.nodes || [],
                };
                params.onComplete?.(completeData.message, completeData.nodes);
                return completeData.message;

              case 'error':
                setStreamingState((prev) => ({
                  ...prev,
                  isStreaming: false,
                  error: data.error,
                }));
                params.onError?.(data.error);
                throw new Error(data.error);
            }
          }
        }

        return accumulatedChunks;
      } catch (error) {
        setStreamingState((prev) => ({
          ...prev,
          isStreaming: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
        params.onError?.(
          error instanceof Error ? error.message : 'Unknown error'
        );
        throw error;
      }
    },
    []
  );

  return {
    streamMessage,
    ...streamingState,
  };
};
