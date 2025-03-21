import { useState } from 'react';
import { useCallback } from 'react';
import { Editor, TLShapeId } from 'tldraw';
import { BrainstormToolCalls } from '../components/brainstorm-tool/toolCalls';
import { z } from 'zod';
import { RichTextShape } from '@/components/shape/rich-text/RichTextShape';
import { calculateNodeSize } from '@/components/chat/utils';

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

              switch (eventType) {
                case 'processing':
                  const { status } = JSON.parse(data);
                  setStreamingState((prev) => ({
                    ...prev,
                    status,
                  }));
                  params.onStatus?.(status);
                  break;

                case 'message-chunk':
                  setStreamingState((prev) => ({
                    ...prev,
                    chunks: prev.chunks + data,
                  }));
                  params.onChunk?.(data);
                  break;

                case 'node-chunk':
                  handleNodeChunk(data, params.editor);
                  break;

                case 'nodes': {
                  const parsedData = JSON.parse(data);
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
                }

                case 'complete': {
                  const parsedData = JSON.parse(data);
                  setStreamingState((prev) => ({
                    ...prev,
                    isStreaming: false,
                    chunks: parsedData.message,
                    nodes: parsedData.nodes || prev.nodes,
                  }));

                  // // Create any remaining nodes that weren't created during streaming
                  // if (parsedData.nodes && Array.isArray(parsedData.nodes)) {
                  //   BrainstormToolCalls.handleBrainstormResult({
                  //     result: parsedData.nodes,
                  //     editor: params.editor,
                  //   });
                  // }

                  params.onComplete?.(
                    parsedData.message,
                    parsedData.nodes || []
                  );
                  break;
                }

                case 'error': {
                  const errorMsg = data;
                  setStreamingState((prev) => ({
                    ...prev,
                    isStreaming: false,
                    error: errorMsg,
                  }));
                  params.onError?.(errorMsg);
                  break;
                }
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

const nodeMessageSchema = z.object({
  id: z.string(),
  chunk: z.string(),
  parentId: z.string().nullable(),
});

const predictionMessageSchema = z.object({
  id: z.string(),
  chunk: z.string(),
  parentId: z.string().nullable(),
});

const handleNodeChunk = (rawData: string, editor: Editor) => {
  try {
    const nodeChunk = nodeMessageSchema.parse(JSON.parse(rawData));

    console.log('nodeChunk', nodeChunk);

    /*
    if we got a new node chunk, two main cases
    1. the node is a new node
    2. the node is an existing node

    we need to check if the node is an existing node by checking if the id is in the editor
    */
    const existingShape = editor.getShape(nodeChunk.id as TLShapeId) as
      | RichTextShape
      | undefined;

    if (existingShape) {
      const newText = existingShape.props.text + nodeChunk.chunk;
      const { width, height } = calculateNodeSize(newText);

      // the node is an existing node
      // we need to update the node
      editor.updateShape<RichTextShape>({
        id: existingShape.id,
        type: 'rich-text',
        props: {
          h: height,
          w: width,
          text: existingShape.props.text + nodeChunk.chunk,
        },
      });
    } else {
      const { width, height } = calculateNodeSize(nodeChunk.chunk);
      // the node is a new node
      editor.createShape<RichTextShape>({
        id: nodeChunk.id as TLShapeId,
        type: 'rich-text',
        props: {
          h: height,
          w: width,
          text: nodeChunk.chunk,
        },
      });
    }
  } catch (error) {
    console.log('Error parsing node chunk:', error, 'chunk: ', rawData);
  }
};

// const handlePredictionChunk = (rawData: string) => {
//   try {
//     const parsedData = predictionMessageSchema.parse(JSON.parse(rawData));

//     console.log('parsedData', parsedData);
//   } catch (error) {
//     console.error('Error parsing prediction chunk:', error);
//   }
// };
