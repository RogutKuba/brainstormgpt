import { ChatProvider } from '@/components/chat/ChatContext';
import { Sidebar, SidebarProvider } from '@/components/landing/Sidebar';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ChatProvider>
      <SidebarProvider>
        <div className='flex'>
          <Sidebar />
          <div className='flex-1'>{children}</div>
        </div>
      </SidebarProvider>
    </ChatProvider>
  );
}
