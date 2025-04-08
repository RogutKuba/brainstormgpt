import { Button } from '@/components/ui/button';
import {
  DialogContent,
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogClose,
} from '@/components/ui/dialog';
import { useZoomDialog } from '@/components/zoom-dialog/ZoomDialogContext';
import { RiCloseLine } from '@remixicon/react';

export const ContentZoomDialog = () => {
  const { open, setOpen, content, title } = useZoomDialog();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader className='flex flex-row items-center justify-between'>
          <DialogTitle>{title}</DialogTitle>
          <DialogClose>
            <Button variant='icon'>
              <RiCloseLine className='h-4 w-4 shrink-0' />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className='overflow-y-auto max-h-[80vh]'>{content}</div>
      </DialogContent>
    </Dialog>
  );
};
