'use client';

import { Button } from '@/components/ui/button';
import { RiBrain2Fill, RiGoogleFill } from '@remixicon/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!NEXT_PUBLIC_API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is required');
}

// Create a separate component that uses useSearchParams
function LoginContent() {
  const searchParams = useSearchParams();
  const prompt = searchParams.get('prompt');

  // Create the login URL with prompt parameter if it exists
  const loginUrl = prompt
    ? `${NEXT_PUBLIC_API_URL}/auth/google/login?prompt=${encodeURIComponent(
        prompt
      )}`
    : `${NEXT_PUBLIC_API_URL}/auth/google/login`;

  return (
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
  );
}

// Fallback component to show while loading
function LoginFallback() {
  return (
    <div className='w-full max-w-md space-y-8 bg-white rounded-xl p-8 shadow-lg'>
      <div className='flex flex-col items-center justify-center text-center'>
        <RiBrain2Fill className='h-16 w-16 text-blue-500' />
        <h1 className='mt-6 text-3xl font-bold tracking-tight text-gray-900'>
          Welcome to Curiosity
        </h1>
        <p className='mt-2 text-gray-500'>Loading...</p>
      </div>
    </div>
  );
}

export function AuthCard() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}
