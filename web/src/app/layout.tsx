'use client';

import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { TanstackQueryClient } from '@/query/client';
import { Toaster } from 'sonner';
import { SidebarProvider } from '@/components/sidebar/SideBarContext';
import { Sidebar } from '@/components/sidebar/Sidebar';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-sidebar`}
      >
        <QueryClientProvider client={TanstackQueryClient}>
          <SidebarProvider>
            <div className='flex h-screen'>
              <Sidebar />
              <div className='flex-1 overflow-y-auto bg-gray-50'>
                {children}
              </div>
            </div>
          </SidebarProvider>
          <Toaster richColors theme='light' duration={2500} />
        </QueryClientProvider>
      </body>
    </html>
  );
}
