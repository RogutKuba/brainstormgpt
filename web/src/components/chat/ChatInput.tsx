'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RiLoader2Fill, RiSendPlane2Line } from '@remixicon/react';

interface ChatInputProps {
  // Core functionality
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => Promise<void> | void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  // Default values for props
  value: externalValue,
  onChange,
  onSubmit,
  placeholder = 'Ask anything...',
  disabled = false,
  isLoading = false,
}) => {
  // Internal state for controlled or uncontrolled usage
  const [internalValue, setInternalValue] = useState('');

  // Determine if we're using controlled or uncontrolled input
  const isControlled = externalValue !== undefined;
  const value = isControlled ? externalValue : internalValue;

  // Handle input change
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (!isControlled) {
      setInternalValue(e.target.value);
    }
    onChange?.(e.target.value);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate input
    if (!value.trim() || value.trim().length < 3 || disabled) {
      return;
    }

    // If external submit handler is provided, use it
    if (onSubmit) {
      await onSubmit(value);
      if (!isControlled) {
        setInternalValue('');
      }
      return;
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className='w-full p-4 rounded-xl border border-gray-200 bg-white'
    >
      <textarea
        value={value}
        onChange={(e) => {
          handleChange(e);
          // Auto-resize the textarea
          e.target.style.height = 'auto';
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
        placeholder={placeholder}
        className='w-full resize-none border-none focus:outline-none focus:ring-0 bg-transparent overflow-y-auto max-h-[200px]'
        disabled={disabled}
        rows={1}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
      />

      {/* Action buttons row */}
      <div className='flex items-center justify-end mt-2'>
        {/* <div className='flex items-center gap-2'>
          {showActionButtons && (
            <>
              <Button
                variant='icon'
                className='rounded-full w-8 h-8 bg-gray-100 text-gray-600 hover:bg-gray-200'
                type='button'
              >
                <RiAttachment2 className='w-4 h-4' />
              </Button>
              <Button
                variant='icon'
                className='rounded-full w-8 h-8 bg-gray-100 text-gray-600 hover:bg-gray-200'
                type='button'
              >
                <RiSearchLine className='w-4 h-4' />
              </Button>
              <Button
                variant='icon'
                className='rounded-full w-8 h-8 bg-gray-100 text-gray-600 hover:bg-gray-200'
                type='button'
              >
                <RiBrainLine className='w-4 h-4' />
              </Button>
            </>
          )}
        </div> */}

        {/* Right side - Send button */}
        <Button
          type='submit'
          variant='primary'
          className='rounded-full w-8 h-8 bg-blue-500 text-white hover:bg-blue-600 flex items-center justify-center'
          disabled={!value.trim() || value.trim().length < 3 || disabled}
        >
          {isLoading ? (
            <RiLoader2Fill className='w-4 h-4 shrink-0 animate-spin' />
          ) : (
            <RiSendPlane2Line className='w-4 h-4 shrink-0' />
          )}
        </Button>
      </div>
    </form>
  );
};
