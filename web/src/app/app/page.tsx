'use client';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/table';
import {
  RiAddLine,
  RiArrowRightLine,
  RiUserSharedLine,
  RiLogoutBoxLine,
  RiBrain2Fill,
  RiMoreLine,
} from '@remixicon/react';
import { CreateWorkspaceDialog } from '@/components/workspace/CreateWorkspaceDialog';
import { JoinWorkspaceDialog } from '@/components/workspace/JoinWorkspaceDialog';
import { useRouter } from 'next/navigation';
import { useWorkspaces } from '@/query/workspace.query';
import { Skeleton } from '@/components/ui/skeleton';
import { useLogout, useUserData } from '@/query/auth.query';

export default function DashboardPage() {
  const router = useRouter();

  const { user, isLoading: isUserLoading } = useUserData();
  const { workspaces, isLoading } = useWorkspaces();
  const { logout } = useLogout();

  return (
    <div className='min-h-screen'>
      {/* Header */}
      <header className='w-full border-b border-gray-200 bg-white shadow-sm py-4 px-2 md:px-0'>
        <div className='container max-w-6xl mx-auto flex justify-between items-center px-4 sm:px-4 lg:px-0'>
          <div className='flex items-center'>
            <span className='text-xl font-bold flex items-center gap-1'>
              <RiBrain2Fill className='w-6 h-6 text-blue-500' />
              <span className=''>Tangent</span>
            </span>
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
                <span className='hidden md:inline'>Logout</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className='container max-w-3xl mx-auto py-8 md:py-12 px-4 sm:px-4 md:px-0'>
        <div className='flex flex-row justify-between items-center gap-4 md:gap-0 mb-8'>
          <h1 className='text-2xl sm:text-3xl font-bold text-gray-900'>
            Your Workspaces
          </h1>

          {/* Desktop buttons */}
          <div className='hidden md:flex items-center gap-2'>
            <JoinWorkspaceDialog>
              <Button
                variant='light'
                className='hover:bg-gray-100 transition-colors'
              >
                <RiUserSharedLine className='w-4 h-4' />
                <span>Join Workspace</span>
              </Button>
            </JoinWorkspaceDialog>

            <CreateWorkspaceDialog>
              <Button className='flex items-center gap-2'>
                <RiAddLine className='w-4 h-4' />
                <span>Create Workspace</span>
              </Button>
            </CreateWorkspaceDialog>
          </div>

          {/* Mobile buttons - for sm to md screens */}
          <div className='flex md:hidden items-center gap-2 w-full justify-end'>
            <JoinWorkspaceDialog>
              <Button variant='light' className='text-xs sm:text-sm'>
                <RiUserSharedLine className='w-3 h-3 mr-1' />
                Join
              </Button>
            </JoinWorkspaceDialog>

            <CreateWorkspaceDialog>
              <Button className='text-xs sm:text-sm'>
                <RiAddLine className='w-3 h-3 mr-1' />
                Create
              </Button>
            </CreateWorkspaceDialog>
          </div>
        </div>

        <div className='overflow-x-auto -mx-4 sm:-mx-4 md:mx-0 bg-white rounded-lg shadow-sm border border-gray-200'>
          <Table>
            <TableHead>
              <TableRow className='bg-gray-50'>
                <TableHeaderCell className='w-1/3'>Name</TableHeaderCell>
                <TableHeaderCell className='w-1/3'>Code</TableHeaderCell>
                <TableHeaderCell className='text-right'></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <>
                  <TableRow>
                    <TableCell>
                      <Skeleton className='w-full h-4' />
                    </TableCell>
                    <TableCell>
                      <Skeleton className='w-full h-4' />
                    </TableCell>
                    <TableCell className='flex justify-end'>
                      <Skeleton className='w-4/5 h-4' />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Skeleton className='w-full h-4' />
                    </TableCell>
                    <TableCell>
                      <Skeleton className='w-full h-4' />
                    </TableCell>
                    <TableCell className='flex justify-end'>
                      <Skeleton className='w-4/5 h-4' />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Skeleton className='w-full h-4' />
                    </TableCell>
                    <TableCell>
                      <Skeleton className='w-full h-4' />
                    </TableCell>
                    <TableCell className='flex justify-end'>
                      <Skeleton className='w-4/5 h-4' />
                    </TableCell>
                  </TableRow>
                </>
              ) : workspaces && workspaces.length > 0 ? (
                workspaces.map((workspace, index) => (
                  <TableRow
                    key={index}
                    className='hover:bg-blue-50/25 transition-colors'
                  >
                    <TableCell className='font-medium'>
                      {workspace.name}
                    </TableCell>
                    <TableCell className='font-mono text-sm text-gray-600'>
                      {workspace.id}
                    </TableCell>
                    <TableCell className='text-right'>
                      <Button
                        variant='secondary'
                        onClick={() =>
                          router.push(`/app/workspace/${workspace.id}`)
                        }
                        className='text-xs sm:text-sm'
                      >
                        <span className='hidden md:inline'>
                          Enter Workspace
                        </span>
                        <span className='inline md:hidden'>Enter</span>
                        <RiArrowRightLine className='w-4 h-4 ml-1' />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className='text-center py-8 text-gray-500'
                  >
                    <div className='flex flex-col items-center gap-2'>
                      <RiBrain2Fill className='w-10 h-10 text-gray-300' />
                      <p>You have not created any workspaces yet.</p>
                      <p className='text-sm'>
                        Create or join a workspace to get started.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
