'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useSendMessage } from '@/query/workspace.query';
import { useStreamMessage } from '@/query/stream.query';
import { Editor } from 'tldraw';

// Define the Message type
export type Message = {
  id: string;
  content: string;
  sender: 'user' | 'system';
  timestamp: Date;
  level?: 'error' | 'info' | 'warning';
  status?: string;
  isStreaming?: boolean;
};

// Define the context value type
interface ChatContextValue {
  messages: Message[];
  isLoading: boolean;
  handleSendMessage: (params: {
    message: string;
    selectedItemIds: string[];
    workspaceId: string;
    predictionId: string | null;
    predictionPosition: {
      x: number;
      y: number;
    } | null;
    editor: Editor;
  }) => Promise<void>;
  clearMessages: () => void;
}

// Create the context
const ChatContext = createContext<ChatContextValue | undefined>(undefined);

// Create a provider component
export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { streamMessage } = useStreamMessage();

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const handleSendMessage = async (params: {
    workspaceId: string;
    message: string;
    selectedItemIds: string[];
    predictionId: string | null;
    predictionPosition: {
      x: number;
      y: number;
    } | null;
    editor: Editor;
  }) => {
    // Check if input has more than 2 characters
    if (params.message.trim().length > 2 && !isLoading) {
      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        content: params.message,
        sender: 'user',
        timestamp: new Date(),
      };

      try {
        setIsLoading(true);
        setMessages((prev) => [...prev, userMessage]);

        // Format chat history for the API
        const formattedChatHistory = messages.map((msg) => ({
          content: msg.content,
          sender: msg.sender,
        }));

        // Create a placeholder for the AI response
        const aiMessageId = (Date.now() + 1).toString();
        setMessages((prev) => [
          ...prev,
          {
            id: aiMessageId,
            content: '',
            sender: 'system',
            timestamp: new Date(),
            isStreaming: true,
          },
        ]);

        // Use streaming API
        await streamMessage({
          message: userMessage.content,
          chatHistory: formattedChatHistory,
          selectedItems: params.selectedItemIds,
          workspaceId: params.workspaceId,
          predictionId: params.predictionId,
          predictionPosition: params.predictionPosition,
          onChunk: (chunk) => {
            // Update the AI message with each new chunk
            setMessages((prev) => {
              const updatedMessages = [...prev];
              const aiMessageIndex = updatedMessages.findIndex(
                (msg) => msg.id === aiMessageId
              );

              if (aiMessageIndex !== -1) {
                updatedMessages[aiMessageIndex] = {
                  ...updatedMessages[aiMessageIndex],
                  content: updatedMessages[aiMessageIndex].content + chunk,
                };
              }

              return updatedMessages;
            });
          },
          onStatus: (status) => {
            // Update the AI message status
            setMessages((prev) => {
              const updatedMessages = [...prev];
              const aiMessageIndex = updatedMessages.findIndex(
                (msg) => msg.id === aiMessageId
              );

              if (aiMessageIndex !== -1) {
                updatedMessages[aiMessageIndex] = {
                  ...updatedMessages[aiMessageIndex],
                  status,
                };
              }

              return updatedMessages;
            });
          },
          onComplete: (finalMessage) => {
            // Update the AI message with the complete response
            setMessages((prev) => {
              const updatedMessages = [...prev];
              const aiMessageIndex = updatedMessages.findIndex(
                (msg) => msg.id === aiMessageId
              );

              if (aiMessageIndex !== -1) {
                updatedMessages[aiMessageIndex] = {
                  ...updatedMessages[aiMessageIndex],
                  content: finalMessage,
                  isStreaming: false,
                  status: 'complete',
                };
              }

              return updatedMessages;
            });
          },
          onError: (error) => {
            // Update the AI message with the error
            setMessages((prev) => {
              const updatedMessages = [...prev];
              const aiMessageIndex = updatedMessages.findIndex(
                (msg) => msg.id === aiMessageId
              );

              if (aiMessageIndex !== -1) {
                updatedMessages[aiMessageIndex] = {
                  ...updatedMessages[aiMessageIndex],
                  content: `Error: ${error}`,
                  isStreaming: false,
                  level: 'error',
                };
              }

              return updatedMessages;
            });
          },
          editor: params.editor,
        });
      } catch (error) {
        console.error('Error fetching chat response:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const value: ChatContextValue = {
    messages,
    isLoading,
    handleSendMessage,
    clearMessages,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

// Create a hook to use the chat context
export const useChat = (): ChatContextValue => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
