'use client';

import { Whiteboard } from '@/app/components/Whiteboard';
import { useParams } from 'next/navigation';
import 'tldraw/tldraw.css';

export default function WorkspacePage() {
  const { workspaceId } = useParams();
  return <Whiteboard workspaceId={workspaceId as string} />;
}
