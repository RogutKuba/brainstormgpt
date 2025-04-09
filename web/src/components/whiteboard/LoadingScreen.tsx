import { motion } from 'motion/react';
import { RiLoader2Line } from '@remixicon/react';

export const CustomLoadingScreen = () => {
  return (
    <div className='flex flex-col items-center justify-center h-full w-full'>
      {/* Loading text with fade-in effect */}
      <motion.h2
        className='text-2xl font-medium mb-4 text-center'
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        Loading your insights
      </motion.h2>

      {/* Spinning loader animation */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{
          duration: 1.2,
          repeat: Infinity,
          ease: 'linear',
        }}
        className='text-primary'
      >
        <RiLoader2Line className='w-8 h-8' />
      </motion.div>
    </div>
  );
};
