'use client';

import { Button } from '@/components/ui/button';
import { RiBrain2Fill, RiGoogleFill } from '@remixicon/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!NEXT_PUBLIC_API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is required');
}

interface LoginDialogProps {
  isOpen: boolean;
  onClose: () => void;
  prompt?: string;
}

export function LoginDialog({ isOpen, onClose, prompt }: LoginDialogProps) {
  // Create the login URL with prompt parameter if it exists
  const loginUrl = prompt
    ? `${NEXT_PUBLIC_API_URL}/auth/google/login?prompt=${encodeURIComponent(
        prompt
      )}`
    : `${NEXT_PUBLIC_API_URL}/auth/google/login`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <div className='flex flex-col items-center justify-center text-center mb-4'>
            <RiBrain2Fill className='h-12 w-12 text-blue-500' />
            <DialogTitle className='mt-4 text-2xl'>Join Curiosity</DialogTitle>
            <DialogDescription className='mt-2'>
              Sign in to ask your question and save your results for later
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className='flex flex-col space-y-4'>
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
      </DialogContent>
    </Dialog>
  );
}
