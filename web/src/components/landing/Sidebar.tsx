'use client';

import {
  useState,
  useEffect,
  createContext,
  useContext,
  useRef,
  RefObject,
} from 'react';
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
import { SidebarProfile } from '@/components/landing/SidebarProfile';
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

interface SidebarContextType {
  isOpen: boolean;
  toggleSidebar: () => void;
  sideBarRef: RefObject<HTMLDivElement | null>;
}

export const Sidebar = () => {
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
          'h-screen bg-white border-r border-gray-200 shadow-sm z-[301] transition-all duration-300 ease-in-out',
          isOpen ? 'w-64' : 'w-0',
          'flex flex-col overflow-hidden'
        )}
        ref={sideBarRef}
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
            <h2 className='text-sm font-semibold text-gray-500'>
              Chat History
            </h2>

            <div className='flex gap-1'>
              <CreateWorkspaceDialog>
                <Button variant='icon' className='h-7 w-7'>
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
                    <Skeleton className='h-6 w-full' />
                  </div>
                ))
            ) : workspaces && workspaces.length > 0 ? (
              // Workspace items
              workspaces.map((workspace, index) => (
                <Button
                  key={index}
                  variant='ghost'
                  className={cn(
                    'w-full justify-between gap-2 px-3 py-2 text-left hover:bg-blue-50/50',
                    workspace.code === currentWorkspaceCode &&
                      'bg-blue-50 text-blue-600 font-medium'
                  )}
                >
                  {editingWorkspaceId === workspace.id ? (
                    <Input
                      value={editingWorkspaceName}
                      onChange={(e) => setEditingWorkspaceName(e.target.value)}
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
                      inputClassName='py-0 px-0'
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
                        <RiMore2Fill className='w-5 h-5 p-0.5 text-gray-400 flex-shrink-0 hover:text-gray-700 hover:bg-blue-50 rounded transition-colors duration-200' />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingWorkspaceName(workspace.name);
                              setEditingWorkspaceId(workspace.id);
                            }}
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
                            >
                              <span className='flex items-center gap-2'>
                                <RiShareLine className='w-4 h-4' />
                                Share
                              </span>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DialogTrigger asChild>
                          <DropdownMenuItem className='text-red-500'>
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
  sideBarRef: { current: null } as RefObject<HTMLDivElement | null>,
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

  const sideBarRef = useRef<HTMLDivElement>(null);

  return (
    <SidebarContext.Provider value={{ isOpen, toggleSidebar, sideBarRef }}>
      {children}
    </SidebarContext.Provider>
  );
};
