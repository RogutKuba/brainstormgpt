'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  RiAddLine,
  RiBrain2Fill,
  RiMore2Fill,
  RiContractLeftLine,
  RiDeleteBinLine,
  RiPencilLine,
  RiShareLine,
  RiLockLine,
  RiGlobalLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { useUpdateWorkspace, useWorkspaces } from '@/query/workspace.query';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateWorkspaceDialog } from '@/components/workspace/CreateWorkspaceDialog';
import { cn } from '@/components/ui/lib/utils';
import { SITE_ROUTES } from '@/lib/siteConfig';
import Link from 'next/link';
import { SidebarProfile } from '@/components/sidebar/SidebarProfile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown';
import { Dialog, DialogTrigger } from '@radix-ui/react-dialog';
import { DeleteWorkspaceDialog } from '@/components/workspace/DeleteWorkspaceDialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useSidebar } from '@/components/sidebar/SideBarContext';

export const LoggedInSidebar = () => {
  const { isOpen, toggleSidebar, sideBarRef } = useSidebar();
  const router = useRouter();
  const params = useParams();

  // Get the current workspace code from URL params
  const currentWorkspaceCode = params?.workspaceCode as string;

  const { workspaces, isLoading } = useWorkspaces();
  const { updateWorkspace } = useUpdateWorkspace();

  const [isMobile, setIsMobile] = useState(false);

  // State for editing workspace
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(
    null
  );
  const [editingWorkspaceName, setEditingWorkspaceName] = useState<string>('');

  // state for deleting workspace
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);

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

  const handleShareWorkspace = (workspaceCode: string) => {
    try {
      navigator.clipboard.writeText(SITE_ROUTES.CHAT(workspaceCode));
      toast.success('Copied link to clipboard');
    } catch (error) {
      toast.error('Failed to copy link to clipboard');
    }
  };

  const toggleWorkspaceVisibility = async (
    workspaceCode: string,
    isPublic: boolean
  ) => {
    await updateWorkspace({
      workspaceCode,
      isPublic: !isPublic,
    });
  };

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
              {/* Workspace Header */}
              <div className='px-4 mb-2 flex items-center justify-between'>
                <h2 className='text-sm font-semibold text-gray-400'>
                  Chat History
                </h2>

                <div className='flex gap-1'>
                  <CreateWorkspaceDialog>
                    <Button
                      variant='icon'
                      className='h-7 w-7 text-gray-300 hover:text-gray-100 hover:bg-gray-800'
                    >
                      <RiAddLine className='w-4 h-4' />
                    </Button>
                  </CreateWorkspaceDialog>
                </div>
              </div>

              {/* Workspace List */}
              <div className='space-y-1 px-2'>
                {isLoading ? (
                  // Loading skeletons
                  Array(5)
                    .fill(0)
                    .map((_, i) => (
                      <div key={i} className='px-2 py-1'>
                        <Skeleton className='h-6 w-full bg-gray-800' />
                      </div>
                    ))
                ) : workspaces && workspaces.length > 0 ? (
                  // Workspace items
                  workspaces.map((workspace, index) => (
                    <Button
                      key={index}
                      variant='ghost'
                      className={cn(
                        'w-full justify-between gap-2 px-3 py-2 text-left text-gray-300 hover:bg-gray-800/70',
                        workspace.code === currentWorkspaceCode &&
                          'bg-gray-800 text-blue-400 font-medium'
                      )}
                    >
                      {editingWorkspaceId === workspace.id ? (
                        <Input
                          value={editingWorkspaceName}
                          onChange={(e) =>
                            setEditingWorkspaceName(e.target.value)
                          }
                          onBlur={async () => {
                            setEditingWorkspaceId(null);

                            if (editingWorkspaceName === workspace.name) {
                              return;
                            }

                            await updateWorkspace({
                              workspaceCode: workspace.code,
                              name: editingWorkspaceName,
                            });
                          }}
                          inputClassName='py-0 px-0 bg-gray-800 text-gray-100 border-gray-700'
                        />
                      ) : (
                        <span
                          className='truncate flex-grow'
                          onClick={() =>
                            router.push(SITE_ROUTES.CHAT(workspace.code))
                          }
                        >
                          {workspace.name}
                        </span>
                      )}

                      <Dialog
                        open={deleteDialogOpen === workspace.id}
                        onOpenChange={(open) =>
                          setDeleteDialogOpen(open ? workspace.id : null)
                        }
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            asChild
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <RiMore2Fill className='w-5 h-5 p-0.5 text-gray-500 flex-shrink-0 hover:text-gray-300 hover:bg-gray-700 rounded transition-colors duration-200' />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className='bg-gray-800 border-gray-700 text-gray-200'>
                            <DropdownMenuGroup>
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingWorkspaceName(workspace.name);
                                  setEditingWorkspaceId(workspace.id);
                                }}
                                className='hover:bg-gray-700'
                              >
                                <span className='flex items-center gap-2'>
                                  <RiPencilLine className='w-4 h-4' />
                                  Rename
                                </span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  toggleWorkspaceVisibility(
                                    workspace.code,
                                    workspace.isPublic
                                  )
                                }
                                className='hover:bg-gray-700'
                              >
                                <span className='flex items-center gap-2'>
                                  {workspace.isPublic ? (
                                    <>
                                      <RiLockLine className='w-4 h-4' />
                                      Make Private
                                    </>
                                  ) : (
                                    <>
                                      <RiGlobalLine className='w-4 h-4' />
                                      Make Public
                                    </>
                                  )}
                                </span>
                              </DropdownMenuItem>
                              {workspace.isPublic && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleShareWorkspace(workspace.code)
                                  }
                                  className='hover:bg-gray-700'
                                >
                                  <span className='flex items-center gap-2'>
                                    <RiShareLine className='w-4 h-4' />
                                    Share
                                  </span>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator className='bg-gray-700' />
                            <DialogTrigger asChild>
                              <DropdownMenuItem className='text-red-400 hover:bg-gray-700'>
                                <span className='flex items-center gap-2'>
                                  <RiDeleteBinLine className='w-4 h-4' />
                                  Delete
                                </span>
                              </DropdownMenuItem>
                            </DialogTrigger>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <DeleteWorkspaceDialog
                          workspaceCode={workspace.code}
                          workspaceName={workspace.name}
                          setOpen={(open) =>
                            setDeleteDialogOpen(open ? workspace.id : null)
                          }
                        />
                      </Dialog>
                    </Button>
                  ))
                ) : (
                  // Empty state
                  <div className='text-center py-8 px-4'>
                    <p className='text-sm text-gray-400'>No workspaces yet</p>
                    <div className='mt-4 flex flex-col gap-2'>
                      <CreateWorkspaceDialog>
                        <Button className='w-full bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700'>
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

            {/* Current workspace indicator (if any) */}
            {currentWorkspaceCode && workspaces && workspaces.length > 0 && (
              <div className='flex-1 flex flex-col items-center gap-2 overflow-y-auto max-h-[60vh] w-full'>
                {workspaces.map((workspace, index) => (
                  <div
                    key={index}
                    className={cn(
                      'w-8 h-8 rounded-md flex items-center justify-center cursor-pointer',
                      workspace.code === currentWorkspaceCode
                        ? 'bg-gray-800 text-blue-400'
                        : 'hover:bg-gray-800 text-gray-400'
                    )}
                    onClick={() =>
                      router.push(SITE_ROUTES.CHAT(workspace.code))
                    }
                    title={workspace.name}
                  >
                    {workspace.name.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
};
