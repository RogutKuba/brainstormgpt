'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { RiBrain2Fill } from '@remixicon/react';
import { SITE_ROUTES } from '@/lib/siteConfig';
import { useUserData } from '@/query/auth.query';

export const LandingHeader = () => {
  const { user } = useUserData({ shouldRedirect: false });

  return (
    <nav className='flex justify-between items-center mb-16'>
      <Link href={SITE_ROUTES.HOME}>
        <div className='flex items-center'>
          <RiBrain2Fill className='h-8 w-8 text-white mr-1' />
          <span className='font-semibold text-xl text-white'>Curiosity</span>
        </div>
      </Link>

      <div className='flex items-center gap-3'>
        {user ? (
          <Link href={SITE_ROUTES.ACCOUNT}>
            <Button className='bg-transparent hover:bg-white/5 border-white/50 hover:border-white/60'>
              Account
            </Button>
          </Link>
        ) : (
          <Link href={SITE_ROUTES.LOGIN}>
            <Button className='bg-transparent hover:bg-white/5 border-white/50 hover:border-white/60'>
              Sign In
            </Button>
          </Link>
        )}
      </div>
    </nav>
  );
};
