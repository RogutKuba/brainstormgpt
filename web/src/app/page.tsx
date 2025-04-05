'use client';

import { motion } from 'motion/react';
import { RiSendPlaneFill, RiLoader2Fill } from '@remixicon/react';
import { useState } from 'react';
import { LandingHeader } from '@/components/landing/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LandingPricing } from '@/components/landing/Pricing';
import { LandingCarousel } from '@/components/landing/Carousel';
import { useRouter } from 'next/navigation';
import { SITE_ROUTES } from '@/lib/siteConfig';
import {
  useCreateAnonWorkspace,
  useCreateWorkspace,
} from '@/query/workspace.query';
import { useUserData } from '@/query/auth.query';
import { Sidebar } from '@/components/landing/Sidebar';
import { LoginDialog } from '@/components/login/LoginDialog';

export default function Home() {
  const router = useRouter();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Need to create either anon or user workspace depending on if user is logged in and depending if custom prompt or not
  const { user } = useUserData();
  const firstName = user?.name
    ? user.name.split(' ')[0].charAt(0).toUpperCase() +
      user.name.split(' ')[0].slice(1)
    : '';

  const { createWorkspace, isPending: isCreatingUserWorkspace } =
    useCreateWorkspace();
  const { createAnonWorkspace, isPending: isCreatingAnonWorkspace } =
    useCreateAnonWorkspace();
  const [loadingTopicId, setLoadingTopicId] = useState<number | null>(null);

  const isCreatingWorkspace =
    isCreatingUserWorkspace || isCreatingAnonWorkspace;

  const trendingTopics = [
    {
      id: 1,
      title:
        'How will the new US-Canada aluminum tariffs impact consumer prices?',
      image:
        'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80',
    },
    {
      id: 2,
      title:
        'Why are Studio Ghibli images trending across social media platforms?',
      image:
        'https://images.unsplash.com/photo-1541562232579-512a21360020?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80',
    },
    {
      id: 3,
      title: 'How are CRISPR gene editing techniques revolutionizing medicine?',
      image:
        'https://images.unsplash.com/photo-1603126857599-f6e157fa2fe6?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80',
    },
    {
      id: 4,
      title:
        'What does the latest Fed interest rate decision mean for housing markets?',
      image:
        'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80',
    },
    {
      id: 5,
      title:
        'What are the most challenging concepts for first-year university students?',
      image:
        'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80',
    },
  ];

  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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

  // Handle topic click to create an anonymous workspace
  const handleTopicClick = async (topic: (typeof trendingTopics)[0]) => {
    if (isCreatingWorkspace || loadingTopicId !== null) return;

    try {
      setLoadingTopicId(topic.id);
      if (user) {
        const workspace = await createWorkspace({ prompt: topic.title });
        router.push(SITE_ROUTES.CHAT(workspace.code));
      } else {
        // Show login dialog instead of creating anonymous workspace
        setPendingPrompt(topic.title);
        setShowLoginDialog(true);
        setLoadingTopicId(null);
      }
    } catch (error) {
      console.error('Error creating workspace:', error);
      setLoadingTopicId(null);
    }
  };

  return (
    <div className='min-h-screen bg-gradient-to-b from-blue-500 via-blue-400 to-blue-500 text-white overflow-hidden relative'>
      {/* Frosted glass effect */}
      <div className='absolute inset-0 backdrop-blur-md bg-white/10'></div>

      {/* Decorative elements */}
      <div className='absolute top-20 left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl'></div>
      <div className='absolute bottom-20 right-10 w-80 h-80 bg-white/10 rounded-full blur-3xl'></div>

      <div className='w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 relative z-10'>
        <LandingHeader />

        {/* Main Headline */}
        <motion.div
          className='text-center mb-10'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className='text-4xl sm:text-5xl md:text-6xl font-medium mb-2 tracking-tight'>
            Follow your curiosity{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className='text-lg max-w-2xl mx-auto text-white/90 mb-8'>
            A single question can open a world of discovery
          </p>
        </motion.div>

        {/* Chat Input Box */}
        <motion.div
          className='max-w-3xl mx-auto mb-32'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <form
            onSubmit={handleSubmit}
            className='bg-white/10 backdrop-blur-md p-1 rounded-xl shadow-lg border border-white/20'
          >
            <div className='flex items-center bg-white rounded-lg'>
              <input
                type='text'
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder='Ask anything or share a link...'
                className='flex-grow bg-transparent text-gray-800 border-none rounded-lg transition-colors placeholder:text-gray-400 px-5 py-4 focus:outline-none user-select-none focus:ring-0'
                disabled={isLoading}
              />
              <button
                type='submit'
                className='mr-2 p-2 text-white rounded-lg hover:bg-gray-100 transition-colors cursor-pointer'
                disabled={isLoading || !inputValue.trim()}
              >
                {isLoading ? (
                  <RiLoader2Fill className='h-5 w-5 text-primary animate-spin' />
                ) : (
                  <RiSendPlaneFill className='h-5 w-5 text-primary' />
                )}
              </button>
            </div>
          </form>
          <p className='text-center text-white/80 text-sm mt-2'>
            Ask anything that sparks your curiosity or paste an URL to explore
            deeper
          </p>
        </motion.div>

        {/* Trending Topics Section - Infinite Carousel */}
        <motion.div
          className='max-w-3xl mx-auto mb-32'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <LandingCarousel
            topics={trendingTopics}
            onTopicClick={handleTopicClick}
            loadingTopicId={loadingTopicId}
          />
        </motion.div>

        {/* About Curiosity Section */}
        <motion.div
          className='max-w-3xl mx-auto mb-32'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <Card className='bg-white/10 backdrop-blur-md border-white/20 text-white'>
            <CardHeader className='pb-2'>
              <CardTitle className='text-xl'>About Curiosity</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-white/90'>
                Curiosity began when our team of researchers and educators
                noticed a problem: traditional search tools force linear
                thinking, but human curiosity doesn't work that way.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <LandingPricing />
      </div>

      <LoginDialog
        isOpen={showLoginDialog}
        onClose={handleCloseLoginDialog}
        prompt={pendingPrompt}
      />
    </div>
  );
}
