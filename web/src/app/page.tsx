'use client';

import { motion, useAnimationControls } from 'motion/react';
import {
  RiBrain2Fill,
  RiArrowRightLine,
  RiSendPlaneFill,
  RiFireLine,
  RiCheckLine,
  RiStarFill,
} from '@remixicon/react';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { LandingHeader } from '@/components/landing/Header';
import { Tooltip } from '@/components/ui/tooltip';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { LandingPricing } from '@/components/landing/Pricing';

export default function Home() {
  const [inputValue, setInputValue] = useState('');
  const carouselControls = useAnimationControls();
  const carouselRef = useRef<HTMLDivElement>(null);

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
          className='max-w-3xl mx-auto mb-32'
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
                  <Tooltip
                    content={topic.title}
                    key={`${topic.id}-${index}`}
                    side='bottom'
                    className='z-50 bg-white/90 text-gray-800 border border-white/20 backdrop-blur-md shadow-lg rounded-lg p-2 text-sm max-w-xs'
                    arrowClassName='fill-white/90'
                  >
                    <div className='flex-shrink-0 w-64 mx-3 bg-white/10 hover:bg-white/20 rounded-xl cursor-pointer transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md border border-white/10'>
                      <div className='aspect-video overflow-hidden rounded-t-xl'>
                        <img
                          src={topic.image}
                          alt={topic.title}
                          className='w-full h-full object-cover transition-transform duration-300 hover:scale-105 filter brightness-90'
                        />
                      </div>
                      <div className='p-4 w-full'>
                        <p className='font-medium text-white text-sm line-clamp-1 text-left w-full'>
                          {topic.title}
                        </p>
                      </div>
                    </div>
                  </Tooltip>
                ))}
              </motion.div>
            </div>
          </div>
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
              <p className='text-white/90 mb-4'>
                Curiosity began when our team of researchers and educators
                noticed a problem: traditional search tools force linear
                thinking, but human curiosity doesn't work that way.
              </p>
              <p className='text-white/90'>
                Today, Curiosity is used by students, researchers, writers, and
                curious minds across the globe. Our mission is to make knowledge
                exploration more intuitive, enjoyable, and productive for
                everyone.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <LandingPricing />
      </div>
    </div>
  );
}
