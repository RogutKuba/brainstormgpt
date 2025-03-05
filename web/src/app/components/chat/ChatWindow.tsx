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

type Message = {
  id: string;
  content: string;
  sender: 'user' | 'system';
  timestamp: Date;
};

export const ChatWindow: React.FC = () => {
  const editor = useEditor();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [position, setPosition] = useState({
    x: window.innerWidth - 480,
    y: 400,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);

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

  const handleToggleOpen = () => {
    setIsOpen(!isOpen);
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

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();

    if (inputValue.trim()) {
      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        content: inputValue,
        sender: 'user',
        timestamp: new Date(),
      };

      // Add placeholder response
      const systemResponse: Message = {
        id: (Date.now() + 1).toString(),
        content: 'This is a placeholder response to your message.',
        sender: 'system',
        timestamp: new Date(),
      };

      setMessages([...messages, userMessage, systemResponse]);
      setInputValue('');
    }
  };

  if (!isOpen) {
    return (
      <Button
        className='fixed bottom-4 right-4 p-3 bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg'
        onClick={handleToggleOpen}
      >
        <RiChat1Line className='w-5 h-5 text-white' />
      </Button>
    );
  }

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
          <Button
            variant='icon'
            className='p-0 text-gray-300 hover:text-white hover:bg-gray-700 rounded'
            onClick={(e) => {
              e.stopPropagation();
              handleToggleOpen();
            }}
          >
            <RiCloseLine className='w-5 h-5' />
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

                {selectedItems.map((item) => (
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
                ))}
              </div>
            </div>
          </div>

          {/* Chat history - scrollable middle section */}
          <CardContent className='p-0 bg-white grow overflow-y-auto'>
            {messages.length > 0 ? (
              <div className='flex flex-col p-3 space-y-4'>
                {messages.map((message) => (
                  <div key={message.id} className='flex flex-col'>
                    <div className='flex items-center mb-1'>
                      <span className='text-xs font-medium text-gray-500'>
                        {message.sender === 'user' ? 'You' : 'AI Assistant'}
                      </span>
                    </div>
                    <div
                      className={cx(
                        'p-3 rounded-lg',
                        message.sender === 'user'
                          ? 'bg-blue-50 border border-blue-100 text-gray-800'
                          : 'bg-white border border-gray-200 text-gray-800'
                      )}
                    >
                      <p className='text-sm whitespace-pre-wrap'>
                        {message.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>

          {/* Input section - fixed at bottom */}
          <CardFooter className='p-2 border-t border-gray-200 bg-white shrink-0'>
            <form onSubmit={handleSendMessage} className='w-full'>
              <div className='flex items-center gap-2'>
                <Input
                  type='text'
                  placeholder='Ask AI anything...'
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className='flex-1 border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                />
                <Button
                  type='submit'
                  className='p-2 bg-blue-600 hover:bg-blue-700 text-white rounded'
                  disabled={!inputValue.trim()}
                >
                  <RiSendPlaneFill className='w-4 h-4' />
                </Button>
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
