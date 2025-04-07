'use client';

import { useState } from 'react';
import {
  RiAttachment2,
  RiSearchLine,
  RiBrainLine,
  RiSendPlaneFill,
  RiLoader2Fill,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { SITE_ROUTES } from '@/lib/siteConfig';
import {
  useCreateWorkspace,
  useCreateAnonWorkspace,
} from '@/query/workspace.query';
import { useUserData } from '@/query/auth.query';
import { LoginDialog } from '@/components/login/LoginDialog';
import { motion } from 'motion/react';

export default function NewChat() {
  const router = useRouter();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState('');

  // Get user data to personalize the experience
  const { user } = useUserData();
  const firstName = user?.name
    ? user.name.split(' ')[0].charAt(0).toUpperCase() +
      user.name.split(' ')[0].slice(1)
    : '';

  // Workspace creation hooks
  const { createWorkspace, isPending: isCreatingUserWorkspace } =
    useCreateWorkspace();
  const { createAnonWorkspace, isPending: isCreatingAnonWorkspace } =
    useCreateAnonWorkspace();

  const isCreatingWorkspace =
    isCreatingUserWorkspace || isCreatingAnonWorkspace;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      if (user) {
        setIsLoading(true);
        try {
          const workspace = await createWorkspace({ prompt: inputValue });
          router.push(SITE_ROUTES.CHAT(workspace.code));
        } catch (error) {
          console.error('Navigation error:', error);
          setIsLoading(false);
        }
      } else {
        // Show login dialog instead of redirecting
        setPendingPrompt(inputValue);
        setShowLoginDialog(true);
        setIsLoading(false);
      }
    }
  };

  const handleCloseLoginDialog = () => {
    setShowLoginDialog(false);
    setPendingPrompt('');
  };

  const handleModeSelection = (mode: string) => {
    // In the future, this could set a mode parameter for the workspace creation
    console.log(`Selected mode: ${mode}`);
  };

  return (
    <div className='flex flex-col items-center justify-between h-full w-full'>
      {/* Empty state with logo and welcome message */}
      <div className='flex-1 flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-4'>
        <motion.div
          className='rounded-full bg-blue-100 p-4 mb-6'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className='w-10 h-10 text-blue-500 flex items-center justify-center text-2xl'>
            ⌀
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <h1 className='text-2xl font-bold mb-2'>
            {firstName
              ? `Hey ${firstName}! I'm Curiosity`
              : "Hey! I'm Curiosity"}
          </h1>
          <p className='text-gray-500 mb-12 text-center'>
            A single question can open a world of discovery
          </p>
        </motion.div>

        {/* Input form */}
        <motion.div
          className='w-full max-w-2xl'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <form onSubmit={handleSubmit} className='relative'>
            <input
              type='text'
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder='Ask anything...'
              className='w-full p-4 pr-24 rounded-full border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
              disabled={isLoading || isCreatingWorkspace}
            />
            <div className='absolute right-2 top-2 flex items-center gap-1'>
              <Button
                type='button'
                variant='ghost'
                className='rounded-full w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                disabled={isLoading || isCreatingWorkspace}
              >
                <RiAttachment2 className='w-5 h-5' />
              </Button>
              <Button
                type='button'
                variant='ghost'
                className='rounded-full w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                disabled={isLoading || isCreatingWorkspace}
              >
                <RiSearchLine className='w-5 h-5' />
              </Button>
              <Button
                type='button'
                variant='ghost'
                className='rounded-full w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                disabled={isLoading || isCreatingWorkspace}
              >
                <RiBrainLine className='w-5 h-5' />
              </Button>
              <Button
                type='submit'
                variant='primary'
                className='rounded-full w-8 h-8 bg-blue-500 text-white hover:bg-blue-600'
                disabled={
                  !inputValue.trim() || isLoading || isCreatingWorkspace
                }
              >
                {isLoading || isCreatingWorkspace ? (
                  <RiLoader2Fill className='w-5 h-5 animate-spin' />
                ) : (
                  <RiSendPlaneFill className='w-5 h-5' />
                )}
              </Button>
            </div>
          </form>
        </motion.div>
      </div>

      {/* Mode selection buttons */}
      <motion.div
        className='w-full max-w-2xl mx-auto mb-12 px-4'
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <div className='flex justify-center gap-3 flex-wrap'>
          <Button
            variant='light'
            className='rounded-full bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            onClick={() => handleModeSelection('fast')}
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
            onClick={() => handleModeSelection('in-depth')}
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
            onClick={() => handleModeSelection('magic')}
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
            onClick={() => handleModeSelection('holistic')}
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
      </motion.div>

      {/* Footer disclaimer */}
      <motion.div
        className='w-full text-center pb-4 text-gray-400 text-sm'
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        Curiosity can make mistakes. Check for important info.
      </motion.div>

      {/* Login Dialog */}
      <LoginDialog
        isOpen={showLoginDialog}
        onClose={handleCloseLoginDialog}
        prompt={pendingPrompt}
      />
    </div>
  );
}
