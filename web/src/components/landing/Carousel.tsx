'use client';

import { motion, useAnimationControls } from 'motion/react';
import { RiLoader2Fill } from '@remixicon/react';
import { useEffect, useRef, useState } from 'react';
import { Tooltip } from '@/components/ui/tooltip';

type TrendingTopic = {
  id: number;
  title: string;
  image: string;
};

interface CarouselProps {
  topics: TrendingTopic[];
  onTopicClick: (topic: TrendingTopic) => void;
  loadingTopicId: number | null;
}

export const LandingCarousel = ({
  topics,
  onTopicClick,
  loadingTopicId,
}: CarouselProps) => {
  const carouselControls = useAnimationControls();
  const carouselRef = useRef<HTMLDivElement>(null);

  // Duplicate topics for seamless looping
  const duplicatedTopics = [...topics, ...topics];

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
              <div
                className='flex-shrink-0 w-64 mx-3 bg-white/10 hover:bg-white/20 rounded-xl cursor-pointer transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md border border-white/10'
                onClick={() => onTopicClick(topic)}
              >
                <div className='aspect-video overflow-hidden rounded-t-xl relative'>
                  <img
                    src={topic.image}
                    alt={topic.title}
                    className='w-full h-full object-cover transition-transform duration-300 hover:scale-105 filter brightness-90'
                  />
                  {loadingTopicId === topic.id && (
                    <div className='absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm'>
                      <RiLoader2Fill className='h-8 w-8 text-white animate-spin' />
                    </div>
                  )}
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
  );
};
