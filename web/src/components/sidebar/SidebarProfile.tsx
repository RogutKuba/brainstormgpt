import { Skeleton } from '@/components/ui/skeleton';
import { SITE_ROUTES } from '@/lib/siteConfig';
import { useUserData } from '@/query/auth.query';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

export const SidebarProfile = () => {
  const { user, isLoading } = useUserData();
  const router = useRouter();

  const letter = useMemo(() => {
    return user?.name?.charAt(0).toUpperCase();
  }, [user]);

  return (
    <div
      className='flex items-center justify-between gap-2 p-4 hover:bg-gray-800 cursor-pointer transition-all duration-200'
      onClick={() => {
        router.push(SITE_ROUTES.ACCOUNT);
      }}
    >
      {isLoading || !user ? (
        <Skeleton className='w-full h-6 rounded-full bg-gray-800' />
      ) : (
        <div className='flex items-center gap-2'>
          <div className='w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-white bg-accent'>
            <span className='text-sm'>{letter}</span>
          </div>
          <span className='text-sm truncate text-gray-300'>{user.email}</span>
        </div>
      )}
    </div>
  );
};
