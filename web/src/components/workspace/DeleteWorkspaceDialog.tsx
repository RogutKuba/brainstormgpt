import React, { useState } from 'react';
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDeleteWorkspace } from '@/query/workspace.query';
import { RiDeleteBin7Line, RiLoader2Line } from '@remixicon/react';
import { useRouter } from 'next/navigation';
import { useOptionalWorkspaceCode } from '@/lib/pathUtils';
import { SITE_ROUTES } from '@/lib/siteConfig';

interface DeleteWorkspaceDialogProps {
  workspaceCode: string;
  workspaceName: string;
  setOpen: (open: boolean) => void;
}

export function DeleteWorkspaceDialog({
  workspaceCode,
  workspaceName,
  setOpen,
}: DeleteWorkspaceDialogProps) {
  const router = useRouter();
  const currentWorkspace = useOptionalWorkspaceCode();
  const { deleteWorkspace } = useDeleteWorkspace();

  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);

    try {
      await deleteWorkspace(workspaceCode);

      // get current pa

      if (currentWorkspace === workspaceCode) {
        router.push(SITE_ROUTES.HOME);
      }

      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete Workspace</DialogTitle>
      </DialogHeader>

      <div className='my-6 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-md'>
        <p className='text-sm text-red-800 dark:text-red-300 font-medium'>
          ⚠️ Warning: This action is permanent
        </p>
        <p className='text-xs text-red-700 dark:text-red-400 mt-1'>
          All content related to the{' '}
          <span className='font-semibold' title={workspaceName}>
            {workspaceName.length > 20
              ? `${workspaceName.substring(0, 20)}...`
              : workspaceName}
          </span>{' '}
          workspace will be permanently deleted.
        </p>
      </div>

      <DialogFooter>
        <div className='flex flex-row justify-end gap-2'>
          <DialogClose asChild>
            <Button variant='light' type='button'>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleDelete}
            variant='destructive'
            disabled={loading}
          >
            {loading ? (
              <RiLoader2Line className='h-4 w-4 animate-spin mr-2' />
            ) : (
              <RiDeleteBin7Line className='h-4 w-4 mr-2' />
            )}
            Delete Workspace
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  );
}
