'use client';

import { ChatProvider } from '@/components/chat/ChatContext';

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ChatProvider>{children}</ChatProvider>;
}
