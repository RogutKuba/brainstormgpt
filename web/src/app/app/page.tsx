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
} from '@remixicon/react';
import { CreateWorkspaceDialog } from '@/components/workspace/CreateWorkspaceDialog';
import { JoinWorkspaceDialog } from '@/components/workspace/JoinWorkspaceDialog';
import { useRouter } from 'next/navigation';
// Updated mock data to represent workspaces
const mockWorkspaces: {
  name: string;
  code: string;
  created: string;
  participants: number;
}[] = [
  {
    name: 'Meeting Workspace A',
    code: '123456',
    created: '2023-09-15',
    participants: 5,
  },
  {
    name: 'Project Brainstorm',
    code: '123456',
    created: '2023-10-02',
    participants: 3,
  },
  {
    name: 'Team Standup',
    code: '123456',
    created: '2023-10-10',
    participants: 8,
  },
  {
    name: 'Client Presentation',
    code: '123456',
    created: '2023-10-12',
    participants: 4,
  },
];

export default function DashboardPage() {
  const router = useRouter();

  return (
    <>
      {/* Header */}
      <header className='w-full border-b border-gray-200 py-4'>
        <div className='container max-w-6xl mx-auto flex justify-between items-center'>
          <div className='flex items-center'>
            <span className='text-xl font-bold flex items-center gap-1'>
              <RiBrain2Fill className='w-6 h-6 text-pink-400' /> BrainstormGPT
            </span>
          </div>
          <Button variant='secondary' className='flex items-center gap-2'>
            <RiLogoutBoxLine className='w-4 h-4' />
            <span>Logout</span>
          </Button>
        </div>
      </header>

      <div className='container max-w-3xl mx-auto py-8'>
        <div className='flex justify-between items-center mb-2'>
          <h1 className='text-2xl font-bold text-gray-900'>Your Workspaces</h1>

          <div className='flex items-center gap-2'>
            <JoinWorkspaceDialog>
              <Button variant='light'>
                <RiUserSharedLine className='w-4 h-4' />
                <span>Join Workspace</span>
              </Button>
            </JoinWorkspaceDialog>

            <CreateWorkspaceDialog>
              <Button className='flex items-center gap-2'>
                <RiAddLine className='w-4 h-4' />
                <span>Add Workspace</span>
              </Button>
            </CreateWorkspaceDialog>
          </div>
        </div>

        <div className=''>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell className='w-1/3'>Name</TableHeaderCell>
                <TableHeaderCell className='w-1/3'>Code</TableHeaderCell>
                <TableHeaderCell className='text-right'></TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mockWorkspaces.map((workspace, index) => (
                <TableRow key={index} className='hover:bg-gray-50'>
                  <TableCell className='font-medium'>
                    {workspace.name}
                  </TableCell>
                  <TableCell>{workspace.code}</TableCell>
                  <TableCell className='text-right'>
                    <Button
                      variant='secondary'
                      onClick={() =>
                        router.push(`/app/workspace/${workspace.code}`)
                      }
                    >
                      Enter Workspace
                      <RiArrowRightLine className='w-4 h-4' />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {mockWorkspaces.length === 0 && (
          <div className='text-center py-12 bg-gray-50 rounded-lg'>
            <p className='text-gray-500'>You don't have any workspaces yet.</p>
            <Button className='mt-4'>Create Your First Workspace</Button>
          </div>
        )}
      </div>
    </>
  );
}
