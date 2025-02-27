'use client';

import { Whiteboard } from '@/app/components/Whiteboard';
import { useParams } from 'next/navigation';
import 'tldraw/tldraw.css';

export default function RoomPage() {
  const { roomId } = useParams();
  return <Whiteboard roomId={roomId as string} />;
}
