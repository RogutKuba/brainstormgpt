'use client';

import { Button } from '@/components/ui/button';
import { RiBrain2Fill, RiGoogleFill } from '@remixicon/react';

const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!NEXT_PUBLIC_API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is required');
}

export default function LoginPage() {
  return (
    <div className='flex min-h-screen flex-col items-center justify-center px-4 py-12'>
      <div className='w-full max-w-md space-y-8 bg-white rounded-lg p-8 shadow-md border border-gray-200'>
        <div className='flex flex-col items-center justify-center text-center'>
          <RiBrain2Fill className='h-16 w-16 text-gray-900 text-pink-400' />
          <h1 className='mt-6 text-3xl font-bold tracking-tight text-gray-900'>
            Welcome to BrainstormGPT
          </h1>
          <p className='mt-2 text-gray-600'>Login to your account</p>
        </div>

        <div className='mt-8 space-y-6'>
          <Button asChild variant='secondary' className='w-full'>
            <a href={`${NEXT_PUBLIC_API_URL}/auth/google/login`}>
              <RiGoogleFill className='size-5' aria-hidden={true} />
              Sign in with Google
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
