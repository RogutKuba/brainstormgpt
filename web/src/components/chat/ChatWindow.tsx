'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiSendPlaneFill,
  RiCloseLine,
  RiChat1Line,
  RiText,
} from '@remixicon/react';
import { cx } from '@/components/ui/lib/utils';
import { useEditor, useValue } from 'tldraw';
import { useSendMessage } from '@/query/workspace.query';

type Message = {
  id: string;
  content: string;
  sender: 'user' | 'system';
  timestamp: Date;
  level?: 'error' | 'info' | 'warning';
};

export const ChatWindow: React.FC = () => {
  const editor = useEditor();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [position, setPosition] = useState({
    x: window.innerWidth - 400,
    y: 20,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const { sendMessage } = useSendMessage();
  const [isLoading, setIsLoading] = useState(false);

  // Track selected items from TLDraw
  const selectedItems = useValue(
    'selected items',
    () => {
      if (!editor) return [];

      const selectedShapes = editor.getSelectedShapes();
      return selectedShapes
        .filter((shape) => 'text' in shape.props && shape.props.text.length > 0)
        .map((shape) => {
          // Extract text content if available (handles different shape types)
          let textContent = '';

          // Type-safe approach to access shape properties
          if (shape && 'props' in shape) {
            const props = shape.props as Record<string, any>;
            if (props.text && typeof props.text === 'string') {
              textContent = props.text;
            } else if (props.value && typeof props.value === 'string') {
              textContent = props.value;
            }
          }

          return {
            id: shape.id,
            type: shape.type,
            text: textContent
              ? textContent.substring(0, 10) +
                (textContent.length > 10 ? '...' : '')
              : '',
          };
        });
    },
    [editor]
  );

  // Use TLDraw's useValue hook to make the component reactive to editor state changes
  const chatPosition = useValue(
    'chat position',
    () => {
      // You can use editor state to determine position if needed
      // For now, we'll use the local state
      return position;
    },
    [editor, position]
  );

  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const handleDragStart = (e: React.MouseEvent) => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsDragging(true);
    }
  };

  const handleDragMove = (e: MouseEvent) => {
    if (isDragging && cardRef.current) {
      const cardWidth = cardRef.current.offsetWidth;
      const cardHeight = cardRef.current.offsetHeight;

      // Calculate new position
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Constrain to window boundaries
      const maxX = window.innerWidth - cardWidth;
      const maxY = window.innerHeight - cardHeight;

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
    } else {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if input has more than 2 characters
    if (inputValue.trim().length > 2 && !isLoading) {
      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        content: inputValue,
        sender: 'user',
        timestamp: new Date(),
      };

      // Clear input field
      setInputValue('');

      try {
        setIsLoading(true);
        setMessages((prev) => [...prev, userMessage]);

        // console.log('userMessage', userMessage);

        // Format chat history for the API
        const formattedChatHistory = messages.map((msg) => ({
          content: msg.content,
          sender: msg.sender,
        }));

        const response = await sendMessage({
          message: userMessage.content,
          chatHistory: formattedChatHistory,
          selectedItems: selectedItems.map((item) => item.id),
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

  return (
    <Card
      ref={cardRef}
      className='absolute shadow-lg overflow-hidden border-none w-96 rounded-lg flex flex-col'
      style={{
        left: `${chatPosition.x}px`,
        top: `${chatPosition.y}px`,
        cursor: isDragging ? 'grabbing' : 'auto',
        zIndex: 50,
        maxHeight: '80vh',
      }}
    >
      <CardHeader
        className='py-2 px-4 cursor-grab flex flex-row justify-between items-center bg-gray-800 text-white shrink-0'
        onMouseDown={handleDragStart}
      >
        <CardTitle className='text-base font-medium'>AI Assistant</CardTitle>
        <div className='flex gap-1'>
          <Button
            variant='icon'
            className='p-0 text-gray-300 hover:text-white hover:bg-gray-700 rounded'
            onClick={(e) => {
              e.stopPropagation();
              handleToggleCollapse();
            }}
          >
            {isCollapsed ? (
              <RiArrowUpSLine className='w-5 h-5' />
            ) : (
              <RiArrowDownSLine className='w-5 h-5' />
            )}
          </Button>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <>
          {/* Context section - always visible at the top */}
          <div className='bg-gray-100 border-b border-gray-200 overflow-y-auto max-h-[100px] shrink-0'>
            <div className='p-3'>
              <div className='flex flex-row items-center flex-wrap gap-2 overflow-y-auto no-scrollbar'>
                <p className='text-xs font-medium text-gray-600'>Context</p>

                {selectedItems.length > 0 ? (
                  selectedItems.map((item) => (
                    <div
                      key={item.id}
                      className='flex flex-row items-center gap-0.5 text-xs bg-white border border-gray-200 rounded-md p-1.5 shadow-sm'
                    >
                      <div className='bg-gray-100 rounded-md p-1'>
                        <RiText className='w-3 h-3' />
                      </div>
                      <p className='text-gray-700 text-sm'>
                        {item.text || '(no text)'}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className='text-xs text-gray-500 italic'>
                    Select elements to include them as context
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Chat history - scrollable middle section */}
          <CardContent className='p-0 bg-white grow overflow-y-auto'>
            {messages && messages.length > 0 ? (
              <div className='flex flex-col p-3 space-y-4'>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cx('flex flex-col select-auto')}
                  >
                    {/* <div className='flex items-center mb-1'>
                      <span className='text-xs font-medium text-gray-500'>
                        {message.sender === 'user' ? 'You' : 'AI Assistant'}
                      </span>
                    </div> */}
                    <div
                      className={cx(
                        'p-3 rounded-lg select-auto',
                        message.sender === 'user'
                          ? 'bg-blue-50 border border-blue-100 text-gray-800'
                          : message.level === 'error'
                          ? 'bg-red-50 border border-red-200 text-red-800'
                          : 'bg-white border border-gray-200 text-gray-800'
                      )}
                    >
                      <p
                        className={cx(
                          'text-sm whitespace-pre-wrap select-auto',
                          message.level === 'error' &&
                            'text-red-800 font-medium'
                        )}
                      >
                        {message.content}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Loading indicator bubble */}
                {isLoading && (
                  <div className='flex flex-col'>
                    <div className='bg-white border border-gray-200 text-gray-800 p-3 rounded-lg'>
                      <div className='flex space-x-2'>
                        <div className='w-2 h-2 rounded-full bg-gray-300 animate-pulse'></div>
                        <div
                          className='w-2 h-2 rounded-full bg-gray-300 animate-pulse'
                          style={{ animationDelay: '0.2s' }}
                        ></div>
                        <div
                          className='w-2 h-2 rounded-full bg-gray-300 animate-pulse'
                          style={{ animationDelay: '0.4s' }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>

          {/* Input section - fixed at bottom */}
          <CardFooter className='p-2 border-t border-gray-200 bg-white shrink-0'>
            <form onSubmit={handleSendMessage} className='w-full'>
              <div className='relative'>
                <textarea
                  placeholder={
                    isLoading
                      ? 'Waiting for response...'
                      : 'Generate some ideas...'
                  }
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className='w-full resize-none border rounded-md p-3 pr-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 min-h-[50px] text-sm no-scrollbar'
                  disabled={isLoading}
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                />
                <Button
                  type='submit'
                  className='absolute right-2 bottom-2 p-1.5 bg-transparent hover:bg-gray-100 text-gray-600 rounded-md'
                  disabled={
                    !inputValue.trim() ||
                    inputValue.trim().length < 3 ||
                    isLoading
                  }
                >
                  <RiSendPlaneFill className='w-4 h-4' />
                </Button>
                <div className='absolute bottom-2 left-3 text-xs text-gray-400 hidden'>
                  Press Enter to send, Shift+Enter for new line
                </div>
              </div>
            </form>
          </CardFooter>
        </>
      )}
    </Card>
  );
};

// Create a wrapper component that can be used as a TLDraw plugin
export function ChatWindowPlugin() {
  const editor = useEditor();

  // You can use editor state to determine if the chat should be shown
  const shouldShowChat = useValue(
    'should show chat',
    () => {
      // Logic to determine if chat should be shown based on editor state
      // For example, you might want to show it only in certain modes
      return true; // Always show for now
    },
    [editor]
  );

  if (!shouldShowChat) return null;

  return <ChatWindow />;
}
