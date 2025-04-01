'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  RiLogoutBoxLine,
  RiMenuLine,
  RiAddLine,
  RiUserSharedLine,
} from '@remixicon/react';
import { useLogout, useUserData } from '@/query/auth.query';
import { Sidebar } from '@/components/landing/Sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/components/ui/lib/utils';
import { CreateWorkspaceDialog } from '@/components/workspace/CreateWorkspaceDialog';
import { JoinWorkspaceDialog } from '@/components/workspace/JoinWorkspaceDialog';

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, isLoading: isUserLoading } = useUserData();
  const { logout } = useLogout();

  const toggleSidebar = () => {
    console.log('toggleSidebar', sidebarOpen);
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-950'>
      {/* Sidebar - visible on both desktop and mobile */}
      <Sidebar isOpen={sidebarOpen} onToggle={toggleSidebar} />

      {/* Main Content */}
      <div>
        {/* Header */}
        <header className='w-full border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm py-4 px-4'>
          <div className='container max-w-6xl mx-auto flex justify-between items-center'>
            <div className='flex items-center'>
              <Button variant='icon' onClick={toggleSidebar}>
                <RiMenuLine className='h-5 w-5' />
              </Button>
              <h1 className='text-xl font-bold ml-2'>Dashboard</h1>
            </div>

            <div className='flex items-center gap-2'>
              {isUserLoading ? (
                <Skeleton className='w-24 h-8' />
              ) : (
                <Button
                  variant='secondary'
                  className='flex items-center gap-2 transition-colors'
                  onClick={() => logout()}
                >
                  <RiLogoutBoxLine className='w-4 h-4' />
                  <span className='hidden sm:inline'>Logout</span>
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className='container max-w-6xl mx-auto py-8 px-4'>
          <div className='bg-white dark:bg-gray-900 rounded-lg shadow p-6 text-center'>
            <h2 className='text-2xl font-bold mb-4'>Welcome to Curiosity</h2>
            <p className='text-gray-600 dark:text-gray-400 mb-6'>
              Select a workspace from the sidebar to get started, or create a
              new one.
            </p>

            <div className='flex justify-center gap-4 mt-8'>
              <CreateWorkspaceDialog>
                <Button>
                  <RiAddLine className='w-5 h-5 mr-2' />
                  Create Workspace
                </Button>
              </CreateWorkspaceDialog>

              <JoinWorkspaceDialog>
                <Button>
                  <RiUserSharedLine className='w-5 h-5 mr-2' />
                  Join Workspace
                </Button>
              </JoinWorkspaceDialog>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
