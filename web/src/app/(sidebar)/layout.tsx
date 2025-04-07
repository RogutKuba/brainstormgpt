import { Sidebar, SidebarProvider } from '@/components/landing/Sidebar';

export default function SidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className='flex h-screen bg-primary'>
        <Sidebar />
        <div className='flex-1 overflow-y-auto bg-gray-50'>{children}</div>
      </div>
    </SidebarProvider>
  );
}
