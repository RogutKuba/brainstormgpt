'use client';

import { Whiteboard } from '@/components/Whiteboard';
import { useParams } from 'next/navigation';
import 'tldraw/tldraw.css';

export default function WorkspacePage() {
  const { workspaceCode } = useParams();
  return (
    <div className='flex min-h-screen h-full w-full items-center justify-center bg-gray-50'>
      <div className='w-full min-h-screen relative'>
        <div className='absolute inset-0'>
          <Whiteboard workspaceCode={workspaceCode as string} />
        </div>
      </div>
    </div>
  );
}
