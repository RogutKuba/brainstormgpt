'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { RiBrain2Fill, RiBrainFill } from '@remixicon/react';

export default function Home() {
  const router = useRouter();

  return (
    <div className='flex flex-col items-center justify-center min-h-screen bg-white'>
      <div className='w-full max-w-5xl px-6 py-16'>
        {/* Main Headline */}
        <motion.div
          className='text-center mb-8 flex items-center justify-center gap-4'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <RiBrainFill className='h-24 w-24 text-gray-900 text-pink-400' />
          <h1 className='text-8xl font-black text-gray-900'>BrainstormGPT</h1>
        </motion.div>

        {/* CTA Button */}
        <motion.div
          className='flex justify-center mb-16'
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <button
            onClick={() => router.push('/app/login')}
            className='px-6 py-3 bg-pink-400 text-white font-black rounded-lg hover:bg-pink-500 transition-colors flex items-center'
          >
            Get started
          </button>
        </motion.div>

        {/* Demo Image */}
        <motion.div
          className='rounded-lg border border-gray-200 shadow-lg overflow-hidden'
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
        >
          <div className='aspect-w-16 aspect-h-9 bg-gray-50'>
            <div className='p-4'>
              <div className='bg-white rounded-lg shadow-sm p-4 max-w-4xl mx-auto'>
                <div className='flex items-center mb-4'>
                  <div className='w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3'>
                    <span className='text-blue-600 font-semibold'>BS</span>
                  </div>
                  <div>
                    <h3 className='font-medium'>BrainStorm Session</h3>
                    <p className='text-sm text-gray-500'>
                      Collaborative idea generation
                    </p>
                  </div>
                </div>
                <div className='space-y-3'>
                  <div className='bg-gray-100 rounded-lg p-3'>
                    <p className='text-gray-800'>
                      How might we improve customer onboarding?
                    </p>
                  </div>
                  <div className='bg-blue-50 rounded-lg p-3'>
                    <p className='text-gray-800'>
                      Create interactive tutorials that guide users through key
                      features
                    </p>
                  </div>
                  <div className='bg-green-50 rounded-lg p-3'>
                    <p className='text-gray-800'>
                      Implement a progress tracker to show completion status
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
