import { Sidebar, SidebarProvider } from '@/components/landing/Sidebar';

export default function SidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className='flex h-screen'>
        <Sidebar />
        <div className='flex-1 overflow-y-auto'>{children}</div>
      </div>
    </SidebarProvider>
  );
}
