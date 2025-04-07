'use client';

import { useState } from 'react';
import { RiAttachment2, RiSearchLine, RiBrainLine } from '@remixicon/react';
import { Button } from '@/components/ui/button';

export default function NewChat() {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle chat submission logic here
    console.log('Submitted:', inputValue);
    setInputValue('');
  };

  return (
    <div className='flex flex-col items-center justify-between h-full w-full'>
      {/* Empty state with logo and welcome message */}
      <div className='flex-1 flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-4'>
        <div className='rounded-full bg-gray-100 p-4 mb-6'>
          <div className='w-10 h-10 text-gray-400'>⌀</div>
        </div>
        <h1 className='text-2xl font-bold mb-2'>Hey! I'm Curiosity</h1>
        <p className='text-gray-500 mb-12'>Tell me everything you need</p>

        {/* Input form */}
        <div className='w-full max-w-2xl'>
          <form onSubmit={handleSubmit} className='relative'>
            <input
              type='text'
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder='Ask anything...'
              className='w-full p-4 pr-24 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            />
            <div className='absolute right-2 top-2 flex items-center gap-1'>
              <Button
                type='button'
                variant='ghost'
                className='rounded-full w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              >
                <RiAttachment2 className='w-5 h-5' />
              </Button>
              <Button
                type='button'
                variant='ghost'
                className='rounded-full w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              >
                <RiSearchLine className='w-5 h-5' />
              </Button>
              <Button
                type='button'
                variant='ghost'
                className='rounded-full w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              >
                <RiBrainLine className='w-5 h-5' />
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Mode selection buttons */}
      <div className='w-full max-w-2xl mx-auto mb-12 px-4'>
        <div className='flex justify-center gap-3 flex-wrap'>
          <Button
            variant='light'
            className='rounded-full bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          >
            <svg
              className='w-4 h-4 mr-2 text-green-500'
              viewBox='0 0 24 24'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path
                d='M13 5L21 12L13 19'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
            Fast
          </Button>
          <Button
            variant='light'
            className='rounded-full bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          >
            <svg
              className='w-4 h-4 mr-2 text-amber-500'
              viewBox='0 0 24 24'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
            >
              <circle
                cx='12'
                cy='12'
                r='8'
                stroke='currentColor'
                strokeWidth='2'
              />
            </svg>
            In-depth
          </Button>
          <Button
            variant='light'
            className='rounded-full bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          >
            <svg
              className='w-4 h-4 mr-2 text-blue-500'
              viewBox='0 0 24 24'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path
                d='M12 2L20 7V17L12 22L4 17V7L12 2Z'
                stroke='currentColor'
                strokeWidth='2'
              />
            </svg>
            Magic AI
          </Button>
          <Button
            variant='light'
            className='rounded-full bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
          >
            <svg
              className='w-4 h-4 mr-2 text-purple-500'
              viewBox='0 0 24 24'
              fill='none'
              xmlns='http://www.w3.org/2000/svg'
            >
              <circle
                cx='12'
                cy='12'
                r='10'
                stroke='currentColor'
                strokeWidth='2'
              />
              <path d='M12 6V18' stroke='currentColor' strokeWidth='2' />
              <path d='M6 12H18' stroke='currentColor' strokeWidth='2' />
            </svg>
            Holistic
          </Button>
        </div>
      </div>

      {/* Footer disclaimer */}
      <div className='w-full text-center pb-4 text-gray-400 text-sm'>
        Curiosity can make mistakes. Check for important info.
      </div>
    </div>
  );
}
