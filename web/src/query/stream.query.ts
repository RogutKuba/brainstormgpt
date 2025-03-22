import { useState } from 'react';
import { useCallback } from 'react';
import {
  ArrowShapeUtil,
  createBindingId,
  createShapeId,
  Editor,
  IndexKey,
  TLArrowBinding,
  TLArrowShape,
  TLBindingId,
  TLShapeId,
  ZERO_INDEX_KEY,
} from 'tldraw';
import { BrainstormToolCalls } from '../components/brainstorm-tool/toolCalls';
import { z } from 'zod';
import { RichTextShape } from '@/components/shape/rich-text/RichTextShape';
import { calculateNodeSize } from '@/components/chat/utils';
import { PredictionShape } from '@/components/shape/prediction/PredictionShape';

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

        // Buffer for incomplete chunks
        let buffer = '';

        // Process the stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Process any remaining data in the buffer
            if (buffer.trim()) {
              console.log(
                'Processing remaining buffer after stream end:',
                buffer
              );
              processBuffer(buffer);
            }
            break;
          }

          // Decode the chunk and add to buffer
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          console.log('########################');
          console.log('received-raw-chunk', chunk);

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

              console.log('event-lines', lines);

              if (lines.length < 2) continue;

              const eventType = lines[0].replace('event: ', '');
              const data = lines[1].replace('data: ', '');

              console.log('received event', {
                eventType,
                data,
              });

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
});

const predictionMessageSchema = z.object({
  id: z.string(),
  chunk: z.string(),
  parentId: z.string().nullable(),
});

const handleNodeChunk = (rawData: string, editor: Editor) => {
  try {
    const nodeChunk = nodeMessageSchema.parse(JSON.parse(rawData));

    console.log('nodeChunk.id', nodeChunk.id, Date.now());

    /*
    if we got a new node chunk, two main cases
    1. the node is a new node
    2. the node is an existing node

    we need to check if the node is an existing node by checking if the id is in the editor
    */
    const existingShape = editor.getShape(nodeChunk.id as TLShapeId) as
      | RichTextShape
      | undefined;

    console.log('existingShape', existingShape);

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

      const newTextShape: Pick<RichTextShape, 'id' | 'type' | 'props'> = {
        id: nodeChunk.id as TLShapeId,
        type: 'rich-text',
        props: {
          h: height,
          w: width,
          text: nodeChunk.chunk,
        },
      };

      if (
        nodeChunk.parentId &&
        nodeChunk.parentId !== 'none' &&
        nodeChunk.parentId !== 'null' &&
        nodeChunk.parentId !== 'root'
      ) {
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

    console.log('received-prediction-chunk', predictionChunk);

    // Get the parent node (which should be a RichTextShape)
    const parentShape = predictionChunk.parentId
      ? (editor.getShape(predictionChunk.parentId as TLShapeId) as
          | RichTextShape
          | undefined)
      : undefined;

    // Only proceed if parent exists or parentId is null/none/root
    if (
      !parentShape &&
      predictionChunk.parentId &&
      predictionChunk.parentId !== 'none' &&
      predictionChunk.parentId !== 'null' &&
      predictionChunk.parentId !== 'root'
    ) {
      console.warn('Parent shape not found for prediction', predictionChunk.id);
      return;
    }

    // Check if the prediction already exists
    const existingPrediction = editor.getShape(
      predictionChunk.id as TLShapeId
    ) as PredictionShape | undefined;

    if (existingPrediction) {
      // Update existing prediction
      const newText = existingPrediction.props.text + predictionChunk.chunk;
      const { width, height } = calculateNodeSize(newText);

      editor.updateShape<PredictionShape>({
        id: existingPrediction.id,
        type: 'prediction',
        props: {
          h: height,
          w: width,
          text: newText,
        },
      });
    } else {
      // Create new prediction
      const { width, height } = calculateNodeSize(predictionChunk.chunk);
      const arrowId = createShapeId();

      // Create the prediction shape
      const newPredictionShape: Pick<PredictionShape, 'id' | 'type' | 'props'> =
        {
          id: predictionChunk.id as TLShapeId,
          type: 'prediction',
          props: {
            h: height,
            w: width,
            text: predictionChunk.chunk,
            parentId: predictionChunk.parentId as TLShapeId,
            arrowId: arrowId,
          },
        };

      if (parentShape) {
        // Create arrow shape
        const newArrowShape: Pick<TLArrowShape, 'id' | 'type' | 'index'> = {
          id: arrowId,
          type: 'arrow',
          index: ZERO_INDEX_KEY,
        };

        // Create bindings between parent and prediction
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
            toId: parentShape.id,
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
            toId: predictionChunk.id as TLShapeId,
            meta: {},
            typeName: 'binding',
          },
        ];

        // Create both the prediction shape and arrow shape
        editor.createShapes([newPredictionShape, newArrowShape]);

        // Create the bindings
        editor.createBindings(newBindings);
      } else {
        // Create just the prediction shape without arrows if no parent
        editor.createShapes([newPredictionShape]);
      }
    }
  } catch (error) {
    console.error('Error parsing prediction chunk:', error, 'chunk: ', rawData);
  }
};
