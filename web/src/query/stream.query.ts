import { useState } from 'react';
import { useCallback } from 'react';
import { Editor, TLShapeId } from 'tldraw';
import { BrainstormToolCalls } from '../components/brainstorm-tool/toolCalls';

export type StreamedNode = {
  id: TLShapeId;
  type: string;
  text: string;
  parentId?: TLShapeId;
  predictions?: string[];
};

export const useStreamMessage = () => {
  const [streamingState, setStreamingState] = useState<{
    isStreaming: boolean;
    chunks: string;
    status: string | null;
    error: string | null;
    nodes: StreamedNode[];
  }>({
    isStreaming: false,
    chunks: '',
    status: null,
    error: null,
    nodes: [],
  });

  const streamMessage = useCallback(
    async (params: {
      workspaceId: string;
      message: string;
      chatHistory: { content: string; sender: 'user' | 'system' }[];
      selectedItems: string[];
      predictionId: string | null;
      editor: Editor;
      onChunk?: (chunk: string) => void;
      onStatus?: (status: string) => void;
      onComplete?: (message: string, nodes: StreamedNode[]) => void;
      onError?: (error: string) => void;
    }) => {
      try {
        // Reset streaming state
        setStreamingState({
          isStreaming: true,
          chunks: '',
          status: null,
          error: null,
          nodes: [],
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

        // Track nodes that have already been created
        const createdNodeIds = new Set<TLShapeId>();

        // Process the stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Decode the chunk
          const chunk = decoder.decode(value, { stream: true });

          // Process each event in the chunk
          const events = chunk.split('\n\n').filter(Boolean);

          for (const event of events) {
            const lines = event.split('\n');

            if (lines.length < 2) continue;

            const eventType = lines[0].replace('event: ', '');
            const data = lines[1].replace('data: ', '');

            try {
              // console.log('eventType', eventType);
              // console.log('data', data);
              const parsedData = JSON.parse(data);

              switch (eventType) {
                case 'processing':
                  setStreamingState((prev) => ({
                    ...prev,
                    status: parsedData.status,
                  }));
                  params.onStatus?.(parsedData.status);
                  break;

                case 'chunk':
                  setStreamingState((prev) => ({
                    ...prev,
                    chunks: prev.chunks + parsedData.chunk,
                  }));
                  params.onChunk?.(parsedData.chunk);
                  break;

                case 'nodes':
                  if (parsedData.nodes && Array.isArray(parsedData.nodes)) {
                    const nodes = parsedData.nodes;
                    console.log('nodes', parsedData.nodes);

                    if (parsedData.nodes.length > 0) {
                      // Create the new nodes
                      BrainstormToolCalls.handleBrainstormResult({
                        result: nodes,
                        editor: params.editor,
                      });

                      // Update state with all nodes
                      setStreamingState((prev) => ({
                        ...prev,
                        // nodes: [...prev.nodes, ...newNodes],
                      }));
                    }
                  }
                  break;

                case 'complete':
                  setStreamingState((prev) => ({
                    ...prev,
                    isStreaming: false,
                    chunks: parsedData.message,
                    nodes: parsedData.nodes || prev.nodes,
                  }));

                  // Create any remaining nodes that weren't created during streaming
                  if (parsedData.nodes && Array.isArray(parsedData.nodes)) {
                    BrainstormToolCalls.handleBrainstormResult({
                      result: parsedData.nodes,
                      editor: params.editor,
                    });
                  }

                  params.onComplete?.(
                    parsedData.message,
                    parsedData.nodes || []
                  );
                  break;

                case 'error':
                  setStreamingState((prev) => ({
                    ...prev,
                    isStreaming: false,
                    error: parsedData.error,
                  }));
                  params.onError?.(parsedData.error);
                  break;
              }
            } catch (error) {
              console.log('Error parsing event data:', event);
            }
          }
        }
      } catch (error) {
        console.error('Error streaming message:', error);
        setStreamingState((prev) => ({
          ...prev,
          isStreaming: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
        params.onError?.(
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      return streamingState;
    },
    []
  );

  return {
    streamingState,
    streamMessage,
  };
};
