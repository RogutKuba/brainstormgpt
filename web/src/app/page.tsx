'use client';

import { motion, useAnimationControls } from 'motion/react';
import {
  RiBrain2Fill,
  RiArrowRightLine,
  RiSendPlaneFill,
  RiFireLine,
} from '@remixicon/react';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { LandingHeader } from '@/components/landing/Header';

export default function Home() {
  const [inputValue, setInputValue] = useState('');
  const carouselControls = useAnimationControls();
  const carouselRef = useRef<HTMLDivElement>(null);

  const trendingTopics = [
    {
      id: 1,
      title: 'Climate adaptation strategies',
      image:
        'https://images.unsplash.com/photo-1569163139599-0f4517e36f31?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80',
    },
    {
      id: 2,
      title: 'Quantum computing applications',
      image:
        'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80',
    },
    {
      id: 3,
      title: 'Future of remote work',
      image:
        'https://images.unsplash.com/photo-1584661156681-540e80a161d3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80',
    },
    {
      id: 4,
      title: 'Advances in renewable energy',
      image:
        'https://images.unsplash.com/photo-1509391366360-2e959784a276?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80',
    },
    {
      id: 5,
      title: 'AI in healthcare diagnostics',
      image:
        'https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80',
    },
  ];

  // Duplicate topics for seamless looping
  const duplicatedTopics = [...trendingTopics, ...trendingTopics];

  useEffect(() => {
    const startCarouselAnimation = async () => {
      if (!carouselRef.current) return;

      const carouselWidth = carouselRef.current.scrollWidth / 2;

      await carouselControls.start({
        x: -carouselWidth,
        transition: {
          duration: 30,
          ease: 'linear',
          repeat: Infinity,
        },
      });
    };

    startCarouselAnimation();
  }, [carouselControls]);

  return (
    <div className='min-h-screen bg-gradient-to-b from-blue-500 via-blue-400 to-blue-500 text-white overflow-hidden relative'>
      {/* Background decorative elements */}
      <div className='absolute top-20 left-10 w-64 h-64 bg-white/5 rounded-full blur-3xl'></div>
      <div className='absolute bottom-20 right-10 w-80 h-80 bg-white/5 rounded-full blur-3xl'></div>

      <div className='w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 relative z-10'>
        <LandingHeader />

        {/* Main Headline */}
        <motion.div
          className='text-center mb-10'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className='text-4xl sm:text-5xl md:text-6xl font-medium mb-4 tracking-tight'>
            Follow your curiosity
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
          <div className='bg-white/10 backdrop-blur-md p-1 rounded-xl shadow-lg border border-white/20'>
            <div className='flex items-center bg-white rounded-lg'>
              <input
                type='text'
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder='Ask anything or share a link...'
                className='flex-grow bg-transparent text-gray-800 border-none rounded-lg transition-colors placeholder:text-gray-400 px-5 py-4 focus:outline-none user-select-none focus:ring-0'
              />
              <button className='mr-2 p-2 text-white rounded-lg hover:bg-gray-100 transition-colors'>
                <RiSendPlaneFill className='h-5 w-5 text-primary' />
              </button>
            </div>
          </div>
          <p className='text-center text-white/80 text-sm mt-2'>
            Ask anything that sparks your curiosity or paste an URL to explore
            deeper
          </p>
        </motion.div>

        {/* Trending Topics Section - Infinite Carousel */}
        <motion.div
          className='max-w-3xl mx-auto'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className='bg-white/10 backdrop-blur-md rounded-xl p-6 shadow-lg border border-white/20'>
            <div className='overflow-hidden'>
              <motion.div
                ref={carouselRef}
                className='flex'
                animate={carouselControls}
                onMouseEnter={() => carouselControls.stop()}
                onMouseLeave={() => {
                  if (carouselRef.current) {
                    const carouselWidth = carouselRef.current.scrollWidth / 2;

                    carouselControls.start({
                      x: -carouselWidth,
                      transition: {
                        duration: 30,
                        ease: 'linear',
                        repeat: Infinity,
                      },
                    });
                  }
                }}
              >
                {duplicatedTopics.map((topic, index) => (
                  <div
                    key={`${topic.id}-${index}`}
                    className='flex-shrink-0 w-64 mx-3 bg-white/10 hover:bg-white/20 rounded-xl cursor-pointer transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md border border-white/10'
                  >
                    <div className='aspect-video overflow-hidden'>
                      <img
                        src={topic.image}
                        alt={topic.title}
                        className='w-full h-full object-cover transition-transform duration-300 hover:scale-105'
                      />
                    </div>
                    <div className='p-4'>
                      <div className='flex justify-between items-center'>
                        <p className='font-medium text-white text-sm line-clamp-1'>
                          {topic.title}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <div className='text-center mt-16 text-sm text-white/70'>
          <p>© 2024 Tangent AI. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
