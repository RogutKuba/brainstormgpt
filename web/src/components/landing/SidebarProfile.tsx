import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getRandomColour } from '@/lib/colour';
import { SITE_ROUTES } from '@/lib/siteConfig';
import { useUserData } from '@/query/auth.query';
import { RiSettings3Line } from '@remixicon/react';
import { useRouter } from 'next/navigation';

export const SidebarProfile = () => {
  const { user, isLoading } = useUserData();
  const router = useRouter();

  const letter = user?.name?.charAt(0).toUpperCase();

  return (
    <div
      className='flex items-center justify-between gap-2 p-4 border-t border-gray-200 hover:bg-gray-50 cursor-pointer transition-all duration-200'
      onClick={() => {
        router.push(SITE_ROUTES.ACCOUNT);
      }}
    >
      {isLoading || !user ? (
        <Skeleton className='w-full h-6 rounded-full' />
      ) : (
        <div className='flex items-center gap-2'>
          <div className='w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-white bg-primary'>
            <span className='text-sm'>{letter}</span>
          </div>
          <span className='text-sm truncate'>{user.email}</span>
        </div>
      )}
    </div>
  );
};
