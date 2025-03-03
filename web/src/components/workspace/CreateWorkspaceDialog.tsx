import React from 'react';
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
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { useCreateWorkspace } from '@/app/query/workspace.query';
import { useForm } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { RiAddLine, RiLoader2Line } from '@remixicon/react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';

interface CreateWorkspaceDialogProps {
  children: React.ReactNode;
}

const workspaceFormSchema = z.object({
  name: z.string().min(3).max(50),
  goalPrompt: z.string(),
});

type FormValues = z.infer<typeof workspaceFormSchema>;

export function CreateWorkspaceDialog({
  children,
}: CreateWorkspaceDialogProps) {
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { createWorkspace } = useCreateWorkspace();
  const form = useForm<FormValues>({
    resolver: zodResolver(workspaceFormSchema),
    defaultValues: {
      name: '',
      goalPrompt: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);

    try {
      const workspace = await createWorkspace({
        name: values.name,
        goalPrompt: values.goalPrompt,
      });

      router.push(`/app/workspace/${workspace.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Create a New Workspace</DialogTitle>
              <DialogDescription>
                Set a name and optional goal for your workspace. This will help
                guide the conversation.
              </DialogDescription>
            </DialogHeader>

            <div className='my-6 space-y-4'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Workspace Name</FormLabel>
                    <FormControl>
                      <Input placeholder='My Workspace' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='goalPrompt'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Goal Prompt (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='e.g., I want to generate unique B2B vertical SaaS ideas'
                        className='w-full'
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
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
              <div className='flex flex-row justify-end gap-2'>
                <DialogClose asChild>
                  <Button variant='light' type='button'>
                    Cancel
                  </Button>
                </DialogClose>
                <Button type='submit' disabled={loading}>
                  {loading ? (
                    <RiLoader2Line className='h-4 w-4 animate-spin' />
                  ) : (
                    <RiAddLine className='h-4 w-4' />
                  )}
                  Create
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
