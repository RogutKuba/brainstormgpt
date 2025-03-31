'use client';

import { LandingHeader } from '@/components/landing/Header';
import { Button } from '@/components/ui/button';
import { RiBrain2Fill, RiGoogleFill } from '@remixicon/react';
import { useSearchParams } from 'next/navigation';

const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!NEXT_PUBLIC_API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is required');
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const prompt = searchParams.get('prompt');

  // Create the login URL with prompt parameter if it exists
  const loginUrl = prompt
    ? `${NEXT_PUBLIC_API_URL}/auth/google/login?prompt=${encodeURIComponent(
        prompt
      )}`
    : `${NEXT_PUBLIC_API_URL}/auth/google/login`;

  console.log('loginUrl', loginUrl);

  return (
    <div className='min-h-screen bg-gradient-to-b from-blue-500 via-blue-500 to-blue-400 overflow-hidden relative flex flex-col'>
      {/* Frosted glass effect */}
      <div className='absolute inset-0 backdrop-blur-md bg-white/10'></div>

      {/* Decorative elements */}
      <div className='absolute top-20 left-10 w-64 h-64 bg-white/10 rounded-full blur-3xl'></div>
      <div className='absolute bottom-20 right-10 w-80 h-80 bg-white/10 rounded-full blur-3xl'></div>

      {/* Header/Navigation */}
      <div className='w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 absolute top-0 left-0 right-0 z-20'>
        <LandingHeader />
      </div>

      {/* Login Card - Centered in the remaining space */}
      <div className='flex-1 flex items-center justify-center px-4 relative z-5'>
        <div className='w-full max-w-md space-y-8 bg-white rounded-xl p-8 shadow-lg'>
          <div className='flex flex-col items-center justify-center text-center'>
            <RiBrain2Fill className='h-16 w-16 text-blue-500' />
            <h1 className='mt-6 text-3xl font-bold tracking-tight text-gray-900'>
              Welcome to Curiosity
            </h1>
            <p className='mt-2 text-gray-500'>Sign in to your account</p>
          </div>

          <div className='mt-8 space-y-6'>
            <Button
              asChild
              className='w-full bg-blue-500 hover:bg-blue-600 text-white'
            >
              <a href={loginUrl}>
                <RiGoogleFill className='size-5 mr-2' aria-hidden={true} />
                Sign in with Google
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
