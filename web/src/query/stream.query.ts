import { useState } from 'react';
import { useCallback } from 'react';
import {
  createBindingId,
  createShapeId,
  Editor,
  TLArrowBinding,
  TLArrowShape,
  TLShapeId,
  ZERO_INDEX_KEY,
} from 'tldraw';
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
      message: string;
      searchType: 'text' | 'web' | 'image';
      chatHistory: { content: string; sender: 'user' | 'system' }[];
      selectedItems: string[];
      workspaceId: string;
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
              searchType: params.searchType,
              chatHistory: params.chatHistory,
              selectedItems: params.selectedItems,
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

        // Buffer for incomplete chunks
        let buffer = '';

        // Process the stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Process any remaining data in the buffer
            if (buffer.trim()) {
              processBuffer(buffer);
            }
            break;
          }

          // Decode the chunk and add to buffer
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Process complete events from the buffer
          processBuffer(buffer);

          // Function to process the buffer and extract complete events
          function processBuffer(currentBuffer: string) {
            // Find complete events (those ending with double newlines)
            const events: string[] = [];
            let remainingBuffer = currentBuffer;

            while (true) {
              const eventEndIndex = remainingBuffer.indexOf('\n\n');
              if (eventEndIndex === -1) break;

              // Extract the complete event
              const completeEvent = remainingBuffer.substring(
                0,
                eventEndIndex + 2
              );
              events.push(completeEvent);

              // Remove the processed event from the buffer
              remainingBuffer = remainingBuffer.substring(eventEndIndex + 2);
            }

            // Update the buffer with any remaining incomplete data
            buffer = remainingBuffer;

            // Process each complete event
            for (const event of events) {
              const lines = event.split('\n');

              if (lines.length < 2) continue;

              const eventType = lines[0].replace('event: ', '');
              const data = lines[1].replace('data: ', '');

              try {
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

                  case 'prediction-chunk':
                    handlePredictionChunk(data, params.editor);
                    break;

                  case 'nodes': {
                    const parsedData = JSON.parse(data);
                    if (parsedData.nodes && Array.isArray(parsedData.nodes)) {
                      const nodes = parsedData.nodes;

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
  predictions: z.array(
    z.object({
      text: z.string(),
      type: z.enum(['text', 'image', 'web']),
    })
  ),
});

const predictionMessageSchema = z.object({
  id: z.string(),
  index: z.number().optional(),
  type: z.enum(['text', 'image', 'web']),
  chunk: z.string(),
  parentId: z.string().nullable(),
});

const deletePredictionMessageSchema = z.object({
  id: z.string(),
});

const handleNodeChunk = (rawData: string, editor: Editor) => {
  try {
    const nodeChunk = nodeMessageSchema.parse(JSON.parse(rawData));

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
          minCollapsedHeight: height,
          prevCollapsedHeight: height,
          w: width,
          text: existingShape.props.text + nodeChunk.chunk,
        },
      });
    } else {
      const { width, height } = calculateNodeSize(nodeChunk.chunk);

      const newTextShape: Partial<RichTextShape> &
        Pick<RichTextShape, 'id' | 'type' | 'props'> = {
        id: nodeChunk.id as TLShapeId,
        type: 'rich-text',
        props: {
          h: height,
          w: width,
          text: nodeChunk.chunk,
          isLocked: false,
          isExpanded: true,
          predictions: nodeChunk.predictions,
          minCollapsedHeight: height,
          prevCollapsedHeight: height,
          isRoot: false,
        },
      };

      if (
        nodeChunk.parentId &&
        nodeChunk.parentId !== 'none' &&
        nodeChunk.parentId !== 'null' &&
        nodeChunk.parentId !== 'root'
      ) {
        const parentShape = editor.getShape(nodeChunk.parentId as TLShapeId);

        if (!parentShape) return;

        // Position the new text shape with consistent offset in random directions
        // Use a fixed distance with random direction (positive or negative)
        const offsetDistance = 150 + Math.random() * 50; // 150-200px distance
        const offsetX = offsetDistance * (Math.random() > 0.5 ? 1 : -1); // Random positive or negative
        const offsetY = offsetDistance * (Math.random() > 0.5 ? 1 : -1); // Random positive or negative
        newTextShape.x = parentShape.x + offsetX;
        newTextShape.y = parentShape.y + offsetY;

        const newArrowShape: Pick<TLArrowShape, 'id' | 'type' | 'index'> = {
          id: createShapeId(),
          type: 'arrow',
          index: ZERO_INDEX_KEY,
        };

        // create bindings
        const newBindings: [TLArrowBinding, TLArrowBinding] = [
          {
            id: createBindingId(),
            type: 'arrow',
            props: {
              terminal: 'start',
              normalizedAnchor: {
                x: 0.5,
                y: 0.5,
              },
              isExact: false,
              isPrecise: false,
            },
            fromId: newArrowShape.id,
            toId: nodeChunk.parentId as TLShapeId,
            meta: {},
            typeName: 'binding',
          },
          {
            id: createBindingId(),
            type: 'arrow',
            props: {
              terminal: 'end',
              normalizedAnchor: {
                x: 0.5,
                y: 0.5,
              },
              isExact: false,
              isPrecise: false,
            },
            fromId: newArrowShape.id,
            toId: nodeChunk.id as TLShapeId,
            meta: {},
            typeName: 'binding',
          },
        ];

        editor.createShapes<RichTextShape | TLArrowShape>([
          newTextShape,
          newArrowShape,
        ]);
        editor.createBindings(newBindings);
      } else {
        editor.createShapes<RichTextShape>([newTextShape]);
      }
    }
  } catch (error) {
    console.log('Error parsing node chunk:', error, 'chunk: ', rawData);
  }
};

const handlePredictionChunk = (rawData: string, editor: Editor) => {
  try {
    const predictionChunk = predictionMessageSchema.parse(JSON.parse(rawData));

    // Get the parent node (which should be a RichTextShape)
    const parentShape = predictionChunk.parentId
      ? (editor.getShape(predictionChunk.parentId as TLShapeId) as
          | RichTextShape
          | undefined)
      : undefined;

    // Only proceed if parent exists
    if (
      !parentShape ||
      predictionChunk.parentId === 'none' ||
      predictionChunk.parentId === 'null' ||
      predictionChunk.parentId === 'root'
    ) {
      return;
    }

    // Check if this prediction already exists at the specified index
    const index = predictionChunk.index ?? 0;
    const existingPrediction = parentShape.props.predictions[index];

    if (existingPrediction) {
      // Update the existing prediction at this index
      const updatedPredictions = [...parentShape.props.predictions];
      updatedPredictions[index] = {
        text: existingPrediction.text + predictionChunk.chunk,
        type: predictionChunk.type,
      };

      // Update the parent shape with the updated prediction
      editor.updateShape<RichTextShape>({
        id: parentShape.id,
        type: 'rich-text',
        props: {
          predictions: updatedPredictions,
        },
      });
    } else {
      // Add the new prediction to the parent shape
      const updatedPredictions: RichTextShape['props']['predictions'] = [
        ...parentShape.props.predictions,
        {
          text: predictionChunk.chunk,
          type: predictionChunk.type,
        },
      ];

      // Update the parent shape with the new prediction
      editor.updateShape<RichTextShape>({
        id: parentShape.id,
        type: 'rich-text',
        props: {
          predictions: updatedPredictions,
        },
      });
    }
  } catch (error) {
    console.log('Error parsing prediction chunk:', error, 'chunk: ', rawData);
  }
};
