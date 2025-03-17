'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  RiBrain2Fill,
  RiArrowRightLine,
  RiCalendarLine,
  RiLayoutGridLine,
  RiTableLine,
  RiLinkM,
  RiBookLine,
  RiStarLine,
  RiCheckboxCircleLine,
  RiNodeTree,
  RiGitBranchLine,
  RiGitMergeLine,
  RiMultiImageLine,
  RiGuideLine,
} from '@remixicon/react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function Home() {
  const router = useRouter();

  return (
    <div className='min-h-screen bg-gradient-to-b from-blue-500 via-blue-400 to-blue-500 text-white overflow-hidden relative'>
      {/* Background decorative elements */}
      <div className='absolute top-20 left-10 w-64 h-64 bg-white/5 rounded-full blur-3xl'></div>
      <div className='absolute bottom-20 right-10 w-80 h-80 bg-white/5 rounded-full blur-3xl'></div>

      <div className='w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 relative z-10'>
        {/* Navigation */}
        <nav className='flex justify-between items-center mb-16'>
          <div className='flex items-center'>
            <RiBrain2Fill className='h-8 w-8 text-white mr-1' />
            <span className='font-semibold text-xl'>Tangent</span>
          </div>

          <Link href='/app/login'>
            <button className='hidden md:block px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors'>
              Sign In
            </button>
          </Link>
        </nav>

        {/* Logo */}
        <motion.div
          className='flex justify-center mb-4'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className='bg-white/90 w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg'>
            <RiBrain2Fill className='h-14 w-14 text-blue-500' />
          </div>
        </motion.div>

        {/* Main Headline */}
        <motion.div
          className='text-center mb-6 sm:mb-10'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h1 className='text-6xl sm:text-7xl md:text-8xl font-medium mb-8 tracking-tight'>
            Follow your curiosity anywhere
          </h1>
          <p className='sm:text-xl text-md max-w-2xl mx-auto text-white/90'>
            Ask any question and let your exploration twist, branch, and deepen.
          </p>
          <p className='sm:text-xl text-md max-w-2xl mx-auto mb-12 text-white/90'>
            With AI-guided inquiry, discover connections and explore ideas that
            matter. No dead ends, just endless discovery.
          </p>
        </motion.div>

        {/* Feature highlights */}
        <motion.div
          className='flex justify-center gap-6 mb-12 flex-wrap'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <div className='flex items-center bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm'>
            <RiGitMergeLine className='mr-1' /> Unlimited branching
          </div>
          <div className='flex items-center bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm'>
            <RiMultiImageLine className='mr-1' /> Multi-modal exploration
          </div>
          <div className='flex items-center bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm'>
            <RiGuideLine className='mr-1' /> AI-guided discovery
          </div>
        </motion.div>

        {/* Email signup */}
        <motion.div
          className='flex justify-center mb-16'
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <div className='flex flex-col sm:flex-row gap-2'>
            <input
              type='email'
              placeholder='Enter your email here'
              className='bg-white text-gray-600 border-none rounded-lg transition-colors placeholder:text-gray-400 px-5 py-3 focus:outline-none shadow-lg w-72 sm:w-80'
            />
            <button className='flex items-center justify-center px-6 py-3 bg-black text-white rounded-lg transition-colors hover:bg-gray-800 font-medium shadow-lg'>
              Join waitlist
            </button>
          </div>
        </motion.div>

        {/* App Preview */}
        <motion.div
          className='relative mt-16'
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
        >
          {/* Person looking at mountains */}
          <div className='absolute inset-0 flex justify-center'>
            <div
              className='w-full h-[300px] sm:h-[400px] bg-cover bg-center rounded-t-3xl shadow-2xl'
              style={{
                backgroundImage:
                  'url("https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1740&q=80")',
              }}
            ></div>
          </div>

          {/* App UI */}
          <div className='relative mt-32 bg-white/10 backdrop-blur-sm rounded-xl p-6 mx-auto max-w-5xl shadow-xl border border-white/20'>
            {/* App Tabs */}
            <div className='flex justify-center space-x-4 mb-6 text-sm'>
              <div className='flex items-center px-4 py-2 bg-white/20 rounded-md shadow-sm'>
                <RiLayoutGridLine className='mr-2' /> To do
              </div>
              <div className='flex items-center px-4 py-2 hover:bg-white/10 rounded-md transition-colors cursor-pointer'>
                <RiCalendarLine className='mr-2' /> Calendar
              </div>
              <div className='flex items-center px-4 py-2 hover:bg-white/10 rounded-md transition-colors cursor-pointer'>
                <RiBookLine className='mr-2' /> Notebook
              </div>
              <div className='flex items-center px-4 py-2 hover:bg-white/10 rounded-md transition-colors cursor-pointer'>
                <RiLayoutGridLine className='mr-2' /> Kanban
              </div>
              <div className='flex items-center px-4 py-2 hover:bg-white/10 rounded-md transition-colors cursor-pointer'>
                <RiTableLine className='mr-2' /> Tables
              </div>
              <div className='flex items-center px-4 py-2 hover:bg-white/10 rounded-md transition-colors cursor-pointer'>
                <RiLinkM className='mr-2' /> Links
              </div>
            </div>

            {/* Calendar UI */}
            <div className='bg-white rounded-lg p-6 text-gray-800 shadow-lg'>
              <div className='flex justify-between items-center mb-6'>
                <h2 className='text-2xl font-medium'>September 2024</h2>
                <div className='flex items-center space-x-4'>
                  <span className='text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded'>
                    Week 37
                  </span>
                  <div className='flex'>
                    <button className='p-1.5 rounded hover:bg-gray-100 transition-colors'>
                      <span className='sr-only'>Previous</span>
                      <RiArrowRightLine className='rotate-180' />
                    </button>
                    <button className='p-1.5 rounded hover:bg-gray-100 transition-colors'>
                      <span className='sr-only'>Next</span>
                      <RiArrowRightLine />
                    </button>
                  </div>
                </div>
              </div>

              {/* Calendar grid - enhanced version */}
              <div className='grid grid-cols-7 gap-2 text-center'>
                <div className='text-gray-500 text-sm py-2 font-medium'>
                  Mon
                </div>
                <div className='text-gray-500 text-sm py-2 font-medium'>
                  Tue
                </div>
                <div className='text-gray-500 text-sm py-2 font-medium'>
                  Wed
                </div>
                <div className='text-gray-500 text-sm py-2 font-medium'>
                  Thu
                </div>
                <div className='text-gray-500 text-sm py-2 font-medium'>
                  Fri
                </div>
                <div className='text-gray-500 text-sm py-2 font-medium'>
                  Sat
                </div>
                <div className='text-gray-500 text-sm py-2 font-medium'>
                  Sun
                </div>

                {/* Calendar days */}
                {Array.from({ length: 30 }).map((_, i) => (
                  <div
                    key={i}
                    className={`py-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer ${
                      i === 17
                        ? 'bg-red-100 font-medium'
                        : i === 15
                        ? 'ring-2 ring-blue-400 font-medium'
                        : ''
                    }`}
                  >
                    {i + 1}
                    {i === 15 && (
                      <div className='w-1.5 h-1.5 bg-blue-500 rounded-full mx-auto mt-1'></div>
                    )}
                    {i === 17 && (
                      <div className='w-1.5 h-1.5 bg-red-500 rounded-full mx-auto mt-1'></div>
                    )}
                    {i === 22 && (
                      <div className='w-1.5 h-1.5 bg-green-500 rounded-full mx-auto mt-1'></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Testimonials */}
        <motion.div
          className='mt-24 mb-16 text-center'
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          <div className='flex items-center justify-center mb-4'>
            {[1, 2, 3, 4, 5].map((star) => (
              <RiStarLine
                key={star}
                className='w-5 h-5 text-yellow-300 fill-current'
              />
            ))}
          </div>
          <p className='text-xl italic max-w-2xl mx-auto mb-2'>
            "Tangent has transformed how I learn. I can trace ideas across
            disciplines and uncover patterns I never would have found
            otherwise."
          </p>
          <p className='text-sm text-white/70'>
            Alex Rivera, Researcher at Quantum Labs
          </p>
        </motion.div>
      </div>
    </div>
  );
}
