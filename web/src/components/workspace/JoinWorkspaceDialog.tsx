import React, { useState } from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RiArrowRightLine } from '@remixicon/react';
import { useRouter } from 'next/navigation';
interface JoinWorkspaceDialogProps {
  children: React.ReactNode;
}

export function JoinWorkspaceDialog({ children }: JoinWorkspaceDialogProps) {
  const [workspaceCode, setWorkspaceCode] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // onCreateWorkspace(goalPrompt);
    router.push(`/app/workspace/${workspaceCode}?isNew=true`);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Join a Workspace</DialogTitle>
            <DialogDescription>
              Enter the workspace code to join a workspace.
            </DialogDescription>
          </DialogHeader>

          <div className='my-6'>
            <label
              htmlFor='workspace-code'
              className='block text-sm font-medium mb-2'
            >
              Workspace Code
            </label>
            <Input
              id='workspace-code'
              placeholder='Enter Workspace Code'
              value={workspaceCode}
              onChange={(e) => setWorkspaceCode(e.target.value)}
            />
          </div>

          <DialogFooter>
            <div className='flex flex-row justify-end gap-2'>
              <DialogClose asChild>
                <Button variant='light' type='button'>
                  Cancel
                </Button>
              </DialogClose>
              <Button type='submit'>
                Join Workspace
                <RiArrowRightLine className='w-4 h-4' />
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
