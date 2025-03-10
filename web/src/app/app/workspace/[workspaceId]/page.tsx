'use client';

import { Whiteboard } from '@/components/Whiteboard';
import { useParams } from 'next/navigation';
import 'tldraw/tldraw.css';
// import { ChatWindow } from '@/app/components/chat/ChatWindow';
export default function WorkspacePage() {
  const { workspaceId } = useParams();
  return (
    <div className='flex min-h-screen h-full w-full items-center justify-center'>
      <div className='w-full min-h-screen relative'>
        <div className='absolute inset-0'>
          <Whiteboard workspaceId={workspaceId as string} />
        </div>
      </div>
      {/* <ChatWindow /> */}
    </div>
  );
}
