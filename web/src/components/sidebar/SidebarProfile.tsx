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
      className='flex items-center justify-between gap-2 p-4 cursor-pointer transition-all duration-200'
      onClick={() => {
        router.push(SITE_ROUTES.ACCOUNT);
      }}
    >
      {isLoading || !user ? (
        <Skeleton className='w-full h-6 rounded-full bg-neutral-800' />
      ) : (
        <div className='flex items-center gap-2'>
          <div className='w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-white bg-primary'>
            <span className='text-sm'>{letter}</span>
          </div>
          <span className='text-sm truncate text-neutral-300'>
            {user.email}
          </span>
        </div>
      )}
    </div>
  );
};

export const CollapsedSidebarProfile = () => {
  const { user } = useUserData();

  const letter = useMemo(() => {
    return user?.name?.charAt(0).toUpperCase();
  }, [user]);

  return (
    <div className='w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-white bg-primary'>
      <span className='text-sm'>{letter}</span>
    </div>
  );
};
