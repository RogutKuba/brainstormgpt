'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useSendMessage } from '@/query/workspace.query';
import { useEditor, useValue } from 'tldraw';
import { LinkShape } from '@/components/shape/link/LinkShape';
import { RichTextShape } from '@/components/shape/rich-text/RichTextShape';

// Define the Message type
export type Message = {
  id: string;
  content: string;
  sender: 'user' | 'system';
  timestamp: Date;
  level?: 'error' | 'info' | 'warning';
};

// Define the context value type
interface ChatContextValue {
  messages: Message[];
  isLoading: boolean;
  handleSendMessage: (params: {
    message: string;
    selectedItemIds: string[];
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
  const { sendMessage } = useSendMessage();

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const handleSendMessage = async (params: {
    message: string;
    selectedItemIds: string[];
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

        const response = await sendMessage({
          message: userMessage.content,
          chatHistory: formattedChatHistory,
          selectedItems: params.selectedItemIds,
        });

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            content: response.message,
            sender: 'system',
            timestamp: new Date(),
          },
        ]);
      } catch (error) {
        console.error('Error fetching chat response:', error);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            content:
              "Sorry, I couldn't process your request. Please try again.",
            sender: 'system',
            timestamp: new Date(),
            level: 'error',
          },
        ]);
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
