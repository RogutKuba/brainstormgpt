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
import { useRouter } from 'next/navigation';
import { useCreateWorkspace } from '@/query/workspace.query';
import { useForm } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { RiAddLine, RiLoader2Line, RiSendPlaneFill } from '@remixicon/react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';

interface CreateWorkspaceDialogProps {
  children: React.ReactNode;
}

const workspaceFormSchema = z.object({
  prompt: z.string().min(3).max(1000),
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
      prompt: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);

    try {
      // Use the prompt as the workspace name too
      const workspace = await createWorkspace({
        prompt: values.prompt,
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
                What would you like to explore? Your question will help guide
                the conversation.
              </DialogDescription>
            </DialogHeader>

            <div className='my-6'>
              <FormField
                control={form.control}
                name='prompt'
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className='relative'>
                        <Textarea
                          placeholder='Ask anything or share a link...'
                          className='pr-12 resize-none min-h-[100px]'
                          {...field}
                        />
                        <Button
                          type='submit'
                          className='absolute right-2 bottom-2 p-1.5 bg-transparent hover:bg-gray-100 text-gray-600 rounded-md'
                          disabled={
                            loading ||
                            !field.value.trim() ||
                            field.value.trim().length < 3
                          }
                        >
                          {loading ? (
                            <RiLoader2Line className='h-4 w-4 animate-spin' />
                          ) : (
                            <RiSendPlaneFill className='h-4 w-4' />
                          )}
                        </Button>
                      </div>
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
                    <RiLoader2Line className='h-4 w-4 animate-spin mr-2' />
                  ) : (
                    <RiAddLine className='h-4 w-4 mr-2' />
                  )}
                  Create Workspace
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
