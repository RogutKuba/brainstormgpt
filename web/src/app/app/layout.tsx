'use client';

import { TanstackQueryClient } from '@/app/query/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={TanstackQueryClient}>
      {children}
      <Toaster richColors theme='light' duration={2500} />
    </QueryClientProvider>
  );
}
