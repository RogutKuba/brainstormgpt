'use client';

import { ChatProvider } from '@/components/chat/ChatContext';
import { TanstackQueryClient } from '@/query/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={TanstackQueryClient}>
      <ChatProvider>
        {children}
        <Toaster richColors theme='light' duration={2500} />
      </ChatProvider>
    </QueryClientProvider>
  );
}
