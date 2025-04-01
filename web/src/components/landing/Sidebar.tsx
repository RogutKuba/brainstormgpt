'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import {
  RiAddLine,
  RiBrain2Fill,
  RiMore2Fill,
  RiContractLeftLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { useWorkspaces } from '@/query/workspace.query';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateWorkspaceDialog } from '@/components/workspace/CreateWorkspaceDialog';
import { cn } from '@/components/ui/lib/utils';
import { SITE_ROUTES } from '@/lib/siteConfig';
import Link from 'next/link';
import { SidebarProfile } from '@/components/landing/SidebarProfile';

interface SidebarContextType {
  isOpen: boolean;
  toggleSidebar: () => void;
}

export const Sidebar = () => {
  const { isOpen, toggleSidebar } = useSidebar();

  const router = useRouter();
  const { workspaces, isLoading } = useWorkspaces();

  const [isMobile, setIsMobile] = useState(false);

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
          'fixed top-0 left-0 h-full bg-white border-r border-gray-200 shadow-sm z-[301] transition-all duration-300 ease-in-out',
          isOpen ? 'w-64' : 'w-0',
          'flex flex-col overflow-hidden'
        )}
      >
        {/* Sidebar Header */}
        <div className='flex items-center justify-between p-4 pr-2 border-b border-gray-200'>
          <Link href={SITE_ROUTES.HOME} className='flex items-center gap-2'>
            <RiBrain2Fill className='w-6 h-6 text-blue-500' />
            <span className='font-bold'>Curiosity</span>
          </Link>
          <Button variant='icon' onClick={toggleSidebar}>
            <RiContractLeftLine className='w-5 h-5 text-gray-500' />
          </Button>
        </div>

        {/* Sidebar Content */}
        <div className='flex-1 overflow-y-auto py-4'>
          {/* Workspace Header */}
          <div className='px-4 mb-2 flex items-center justify-between'>
            <h2 className='text-sm font-semibold text-gray-500'>History</h2>

            <div className='flex gap-1'>
              <Link href={SITE_ROUTES.NEW_CHAT}>
                <Button variant='icon' className='h-7 w-7'>
                  <RiAddLine className='w-4 h-4' />
                </Button>
              </Link>
            </div>
          </div>

          {/* Workspace List */}
          <div className='space-y-1 px-2'>
            {isLoading ? (
              // Loading skeletons
              Array(5)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className='px-2 py-2'>
                    <Skeleton className='h-8 w-full' />
                  </div>
                ))
            ) : workspaces && workspaces.length > 0 ? (
              // Workspace items
              workspaces.map((workspace, index) => (
                <Button
                  key={index}
                  variant='ghost'
                  className='w-full justify-between gap-2 px-3 py-2 text-left hover:bg-blue-50/50'
                  onClick={() => router.push(SITE_ROUTES.CHAT(workspace.code))}
                >
                  <span className='truncate flex-grow'>{workspace.name}</span>
                  <RiMore2Fill
                    className='w-4 h-4 text-gray-400 flex-shrink-0 hover:text-gray-700 transition-colors duration-200'
                    onClick={(e) => {
                      // TODO: dropdown menu to edit / delete workspace
                      console.log('clicked');
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                  />
                </Button>
              ))
            ) : (
              // Empty state
              <div className='text-center py-8 px-4'>
                <RiBrain2Fill className='w-10 h-10 text-gray-300 mx-auto mb-2' />
                <p className='text-sm text-gray-500'>No workspaces yet</p>
                <div className='mt-4 flex flex-col gap-2'>
                  <CreateWorkspaceDialog>
                    <Button className='w-full'>
                      <RiAddLine className='w-4 h-4 mr-1' />
                      Create Workspace
                    </Button>
                  </CreateWorkspaceDialog>
                </div>
              </div>
            )}
          </div>
        </div>

        <SidebarProfile />
      </aside>
    </>
  );
};

export const SidebarContext = createContext<SidebarContextType>({
  isOpen: false,
  toggleSidebar: () => {},
});

export const useSidebar = () => {
  return useContext(SidebarContext);
};

export const SidebarProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isOpen, setIsOpen] = useState(true);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <SidebarContext.Provider value={{ isOpen, toggleSidebar }}>
      {children}
    </SidebarContext.Provider>
  );
};
