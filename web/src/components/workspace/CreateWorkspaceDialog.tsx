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
import { Textarea } from '@/components/ui/textarea';
import { useRouter } from 'next/navigation';
interface CreateWorkspaceDialogProps {
  children: React.ReactNode;
}

export function CreateWorkspaceDialog({
  children,
}: CreateWorkspaceDialogProps) {
  const [goalPrompt, setGoalPrompt] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // onCreateWorkspace(goalPrompt);

    // hit api to generate workspace for this user
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create a New Workspace</DialogTitle>
            <DialogDescription>
              Set an optional goal for your workspace. This will help guide the
              conversation.
            </DialogDescription>
          </DialogHeader>

          <div className='my-6'>
            <label
              htmlFor='goal-prompt'
              className='block text-sm font-medium mb-2'
            >
              Goal Prompt (Optional)
            </label>
            <Textarea
              id='goal-prompt'
              placeholder='e.g., I want to generate unique B2B vertical SaaS ideas'
              value={goalPrompt}
              onChange={(e) => setGoalPrompt(e.target.value)}
              className='w-full'
              rows={4}
            />
          </div>

          <div className='mb-6 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-md'>
            <p className='text-sm text-amber-800 dark:text-amber-300 font-medium'>
              ⚠️ Warning: All content in workspaces is public
            </p>
            <p className='text-xs text-amber-700 dark:text-amber-400 mt-1'>
              Anyone with the workspace code can access this workspace and its
              content. Do not share sensitive information.
            </p>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant='light' type='button'>
                Cancel
              </Button>
            </DialogClose>
            <Button type='submit'>Create Workspace</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
