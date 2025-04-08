'use client';

import { useState } from 'react';
import {
  RiAttachment2,
  RiSearchLine,
  RiBrainLine,
  RiSendPlaneFill,
  RiLoader2Fill,
  RiBrain2Fill,
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
import { ChatInput } from '@/components/chat/ChatInput';

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
          className='rounded-full bg-blue-100 p-4 mb-2'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className='w-10 h-10 text-blue-500 flex items-center justify-center text-2xl'>
            <RiBrain2Fill className='w-8 h-8' />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className='text-center'
        >
          <h1 className='text-4xl font-medium mb-2'>
            {firstName
              ? `Follow your curiosity, ${firstName}`
              : 'Follow your curiosity'}
          </h1>
          <p className='text-gray-500 mb-12 text-center'>
            Every discovery starts from a single question
          </p>
        </motion.div>

        {/* Input form */}
        <motion.div
          className='w-full max-w-2xl'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={async (value) => {
              if (value.trim()) {
                if (user) {
                  setIsLoading(true);
                  try {
                    const workspace = await createWorkspace({ prompt: value });
                    router.push(SITE_ROUTES.CHAT(workspace.code));
                  } catch (error) {
                    console.error('Navigation error:', error);
                    setIsLoading(false);
                  }
                } else {
                  // Show login dialog instead of redirecting
                  setPendingPrompt(value);
                  setShowLoginDialog(true);
                  setIsLoading(false);
                }
              }
            }}
            placeholder='Ask any topic or provide a link to begin exploring...'
            disabled={isLoading || isCreatingWorkspace}
            isLoading={isLoading || isCreatingWorkspace}
          />
        </motion.div>
      </div>

      {/* Mode selection buttons
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
      </motion.div> */}

      {/* Login Dialog */}
      <LoginDialog
        isOpen={showLoginDialog}
        onClose={handleCloseLoginDialog}
        prompt={pendingPrompt}
      />
    </div>
  );
}
