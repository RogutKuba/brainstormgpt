import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getRandomColour } from '@/lib/colour';
import { useLogout, useUserData } from '@/query/auth.query';
import { RiLogoutBoxLine } from '@remixicon/react';

export const SidebarProfile = () => {
  const { user, isLoading } = useUserData();
  const { logout } = useLogout();

  const letter = user?.name?.charAt(0).toUpperCase();

  return (
    <div className='flex items-center gap-2 p-4'>
      {isLoading || !user ? (
        <Skeleton className='w-4 h-4 rounded-full' />
      ) : (
        <>
          <div
            className='w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-white'
            style={{ backgroundColor: getRandomColour(user.email) }}
          >
            <span className='text-sm'>{letter}</span>
          </div>
          <span className='text-sm truncate'>{user.email}</span>

          <Button
            variant='icon'
            onClick={() => {
              logout();
            }}
          >
            <RiLogoutBoxLine className='w-4 h-4' />
          </Button>
        </>
      )}
    </div>
  );
};
