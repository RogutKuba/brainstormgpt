'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  RiAddLine,
  RiBrain2Fill,
  RiContractLeftLine,
  RiLoginBoxLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/lib/utils';
import { SITE_ROUTES } from '@/lib/siteConfig';
import Link from 'next/link';
import { useSidebar } from '@/components/sidebar/SideBarContext';
import { CreateWorkspaceDialog } from '@/components/workspace/CreateWorkspaceDialog';
import { LoginDialog } from '@/components/login/LoginDialog';

export const AnonSidebar = () => {
  const { isOpen, toggleSidebar, sideBarRef } = useSidebar();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);

  // Check if we're on mobile for responsive behavior
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);

    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  return (
    <>
      {/* Overlay for mobile - only visible when sidebar is open on mobile */}
      {isOpen && isMobile && (
        <div
          className='fixed inset-0 bg-black/30 z-30 transition-opacity duration-300'
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'h-screen bg-primary shadow-sm z-[301] transition-all duration-300 ease-in-out',
          isOpen ? 'w-64' : 'w-16',
          'flex flex-col overflow-hidden'
        )}
        ref={sideBarRef}
      >
        {isOpen ? (
          // Full sidebar content when open
          <>
            {/* Sidebar Header */}
            <div className='flex items-center justify-between p-4 pr-2'>
              <Link href={SITE_ROUTES.HOME} className='flex items-center gap-2'>
                <RiBrain2Fill className='w-6 h-6 text-blue-400' />
                <span className='font-bold text-gray-100'>Curiosity</span>
              </Link>
              <Button
                variant='icon'
                onClick={toggleSidebar}
                className='text-gray-300 hover:text-gray-100 hover:bg-gray-800'
              >
                <RiContractLeftLine className='w-5 h-5' />
              </Button>
            </div>

            {/* Sidebar Content */}
            <div className='flex-1 overflow-y-auto py-4'>
              {/* Anonymous User Message */}
              <div className='px-4 py-6 text-center'>
                <p className='text-sm text-gray-400 mb-4'>
                  Sign in to save your chats and access them later
                </p>
                <Button
                  className='w-full bg-blue-600 hover:bg-blue-700 text-white'
                  onClick={() => setShowLoginDialog(true)}
                >
                  <RiLoginBoxLine className='w-4 h-4 mr-2' />
                  Sign In
                </Button>
              </div>

              <div className='px-4 mb-2 mt-6'>
                <h2 className='text-sm font-semibold text-gray-400'>
                  Start a New Chat
                </h2>
              </div>

              <div className='px-4 py-2'>
                <CreateWorkspaceDialog>
                  <Button className='w-full bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700'>
                    <RiAddLine className='w-4 h-4 mr-1' />
                    New Chat
                  </Button>
                </CreateWorkspaceDialog>
              </div>

              {/* Features Section */}
              <div className='px-4 mt-8'>
                <h2 className='text-sm font-semibold text-gray-400 mb-3'>
                  Features
                </h2>
                <div className='bg-gray-800/50 rounded-lg p-4'>
                  <ul className='space-y-3 text-sm text-gray-300'>
                    <li className='flex items-start'>
                      <span className='inline-block w-2 h-2 rounded-full bg-blue-500 mt-1.5 mr-2'></span>
                      Ask questions and get visual mind maps
                    </li>
                    <li className='flex items-start'>
                      <span className='inline-block w-2 h-2 rounded-full bg-blue-500 mt-1.5 mr-2'></span>
                      Explore topics with AI-powered research
                    </li>
                    <li className='flex items-start'>
                      <span className='inline-block w-2 h-2 rounded-full bg-blue-500 mt-1.5 mr-2'></span>
                      Sign in to save your work and access premium features
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className='p-4 border-t border-gray-800'>
              <Button
                variant='ghost'
                className='w-full justify-center text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                onClick={() => setShowLoginDialog(true)}
              >
                <RiLoginBoxLine className='w-5 h-5 mr-2' />
                Sign In
              </Button>
            </div>
          </>
        ) : (
          // Collapsed sidebar with icons only
          <div className='flex flex-col items-center h-full py-4'>
            {/* Logo icon */}
            <Link href={SITE_ROUTES.HOME} className='mb-8'>
              <RiBrain2Fill className='w-6 h-6 text-blue-400' />
            </Link>

            {/* Expand button */}
            <Button
              variant='icon'
              onClick={toggleSidebar}
              className='mb-6 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            >
              <RiContractLeftLine className='w-5 h-5 rotate-180' />
            </Button>

            {/* Add workspace button */}
            <CreateWorkspaceDialog>
              <Button
                variant='icon'
                className='mb-6 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              >
                <RiAddLine className='w-5 h-5' />
              </Button>
            </CreateWorkspaceDialog>

            {/* Login button */}
            <Button
              variant='icon'
              className='text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              onClick={() => setShowLoginDialog(true)}
            >
              <RiLoginBoxLine className='w-5 h-5' />
            </Button>
          </div>
        )}
      </aside>

      {/* Login Dialog */}
      <LoginDialog
        isOpen={showLoginDialog}
        onClose={() => setShowLoginDialog(false)}
        prompt=''
      />
    </>
  );
};
