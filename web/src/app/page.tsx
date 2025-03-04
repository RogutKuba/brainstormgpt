'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { RiBrain2Fill, RiBrainFill } from '@remixicon/react';

export default function Home() {
  const router = useRouter();

  return (
    <div className='flex flex-col items-center justify-center min-h-screen bg-white'>
      <div className='w-full max-w-5xl px-4 sm:px-6 py-8 sm:py-16'>
        {/* Main Headline */}
        <motion.div
          className='text-center mb-6 sm:mb-8 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <RiBrain2Fill className='h-16 w-16 sm:h-24 sm:w-24 text-pink-400' />
          <h1 className='text-4xl sm:text-6xl md:text-8xl font-black text-gray-900'>
            BrainstormGPT
          </h1>
        </motion.div>

        {/* CTA Button */}
        <motion.div
          className='flex justify-center mb-8 sm:mb-16'
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <button
            onClick={() => router.push('/app/login')}
            className='px-5 py-3 bg-pink-400 text-white font-black rounded-lg hover:bg-pink-500 transition-colors flex items-center text-sm sm:text-base'
          >
            Get started
          </button>
        </motion.div>

        {/* Demo Image */}
        {/* <motion.div
          className='rounded-lg border border-gray-200 shadow-lg overflow-hidden'
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
        >
          <div className='aspect-w-16 aspect-h-9 bg-gray-50'>
            <div className='p-2 sm:p-4'>
              <div className='bg-white rounded-lg shadow-sm p-3 sm:p-4 max-w-4xl mx-auto'>
                <div className='flex items-center mb-3 sm:mb-4'>
                  <div className='w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-100 flex items-center justify-center mr-2 sm:mr-3'>
                    <span className='text-blue-600 font-semibold text-xs sm:text-base'>
                      BS
                    </span>
                  </div>
                  <div>
                    <h3 className='font-medium text-sm sm:text-base'>
                      BrainStorm Session
                    </h3>
                    <p className='text-xs sm:text-sm text-gray-500'>
                      Collaborative idea generation
                    </p>
                  </div>
                </div>
                <div className='space-y-2 sm:space-y-3'>
                  <div className='bg-gray-100 rounded-lg p-2 sm:p-3'>
                    <p className='text-gray-800 text-xs sm:text-base'>
                      How might we improve customer onboarding?
                    </p>
                  </div>
                  <div className='bg-blue-50 rounded-lg p-2 sm:p-3'>
                    <p className='text-gray-800 text-xs sm:text-base'>
                      Create interactive tutorials that guide users through key
                      features
                    </p>
                  </div>
                  <div className='bg-green-50 rounded-lg p-2 sm:p-3'>
                    <p className='text-gray-800 text-xs sm:text-base'>
                      Implement a progress tracker to show completion status
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div> */}
      </div>
    </div>
  );
}
