import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { RiBrain2Fill } from '@remixicon/react';

export const LandingHeader = () => {
  return (
    <nav className='flex justify-between items-center mb-16'>
      <Link href='/'>
        <div className='flex items-center'>
          <RiBrain2Fill className='h-8 w-8 text-white mr-1' />
          <span className='font-semibold text-xl'>Tangent</span>
        </div>
      </Link>

      <div className='flex items-center gap-3'>
        {/* <Link href='/about'>
          <Button className='bg-transparent hover:bg-white/5 border-white/50 hover:border-white/60'>
            About
          </Button>
        </Link> */}
        <Link href='/app/login'>
          {/* <Button variant='secondary' className='hover:bg-white/90'> */}
          <Button className='bg-transparent hover:bg-white/5 border-white/50 hover:border-white/60'>
            Sign In
          </Button>
        </Link>
      </div>
    </nav>
  );
};
