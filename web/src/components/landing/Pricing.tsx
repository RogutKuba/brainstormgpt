import { RiArrowRightLine } from '@remixicon/react';
import { useRef } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';
import { RiCheckLine } from '@remixicon/react';
import { useInView } from 'motion/react';

export const LandingPricing = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <motion.div
      ref={ref}
      className='mb-16 md:mb-32 px-4 md:px-0'
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6 }}
    >
      <h2 className='text-2xl md:text-3xl font-semibold text-center mb-6 md:mb-8'>
        Choose Your Plan
      </h2>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-3xl mx-auto'>
        {/* Free Plan */}
        <Card className='bg-white/10 backdrop-blur-md border-white/20 text-white overflow-hidden hover:bg-white/15 transition-colors duration-300 h-full flex flex-col'>
          <CardHeader className='pb-4 border-b border-white/10'>
            <CardTitle className='text-xl md:text-2xl font-bold'>
              Free
            </CardTitle>
            <p className='text-3xl md:text-4xl font-bold mt-3'>
              $0<span className='text-sm font-normal ml-1'>/month</span>
            </p>
            <p className='text-white/70 mt-2 text-xs md:text-sm'>
              Perfect for casual exploration.
            </p>
          </CardHeader>
          <CardContent className='pt-4 md:pt-6 flex flex-col flex-grow'>
            <ul className='space-y-3 md:space-y-4 mt-2 md:mt-3 text-xs md:text-sm flex-grow'>
              <li className='flex items-start'>
                <RiCheckLine className='mr-3 h-5 w-5 text-green-400 flex-shrink-0 mt-0.5' />
                <span>Unlimited text searches</span>
              </li>
              <li className='flex items-start'>
                <RiCheckLine className='mr-3 h-5 w-5 text-green-400 flex-shrink-0 mt-0.5' />
                <span>5 premium searches per day (web & image)</span>
              </li>
            </ul>

            <div className='mt-auto pt-4 md:pt-6'>
              <Button className='w-full md:w-auto bg-transparent hover:bg-white/5 border-white/50 hover:border-white/60 text-sm'>
                Get Started
                <RiArrowRightLine className='ml-2 h-4 w-4' />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pro Plan */}
        <Card className='bg-gradient-to-br from-blue-600 to-blue-700 backdrop-blur-md border-white/30 text-white overflow-hidden relative shadow-xl h-full hover:shadow-blue-500/20 transition-shadow duration-300 flex flex-col'>
          <CardHeader className='pb-4 border-b border-white/10'>
            <CardTitle className='text-xl md:text-2xl font-bold'>Pro</CardTitle>
            <p className='text-3xl md:text-4xl font-bold mt-3'>
              $14<span className='text-sm font-normal ml-1'>/month</span>
            </p>
            <p className='text-white/70 mt-2 text-xs md:text-sm'>
              For seriously curious minds.
            </p>
          </CardHeader>
          <CardContent className='pt-4 md:pt-6 flex flex-col flex-grow'>
            <ul className='space-y-3 md:space-y-4 mt-2 md:mt-3 text-xs md:text-sm flex-grow'>
              <li className='flex items-start'>
                <RiCheckLine className='mr-3 h-5 w-5 text-green-400 flex-shrink-0 mt-0.5' />
                <span>Unlimited text searches</span>
              </li>
              <li className='flex items-start'>
                <RiCheckLine className='mr-3 h-5 w-5 text-green-400 flex-shrink-0 mt-0.5' />
                <span>Unlimited premium searches (web & image)</span>
              </li>
              <li className='flex items-start'>
                <RiCheckLine className='mr-3 h-5 w-5 text-green-400 flex-shrink-0 mt-0.5' />
                <div>
                  <span className='mr-2'>File uploads</span>
                  <span className='inline-block text-xs font-medium bg-white/10 text-white rounded-full px-2.5 py-0.5 border border-white/20 backdrop-blur-sm'>
                    Coming Soon
                  </span>
                </div>
              </li>
              <li className='flex items-start'>
                <RiCheckLine className='mr-3 h-5 w-5 text-green-400 flex-shrink-0 mt-0.5' />
                <div>
                  <span className='mr-2'>Chat with your mind map</span>
                  <span className='inline-block text-xs font-medium bg-white/10 text-white rounded-full px-2.5 py-0.5 border border-white/20 backdrop-blur-sm'>
                    Coming Soon
                  </span>
                </div>
              </li>
              <li className='flex items-start'>
                <RiCheckLine className='mr-3 h-5 w-5 text-green-400 flex-shrink-0 mt-0.5' />
                <div>
                  <span className='mr-2'>Agentic mode</span>
                  <span className='inline-block text-xs font-medium bg-white/10 text-white rounded-full px-2.5 py-0.5 border border-white/20 backdrop-blur-sm'>
                    Coming Soon
                  </span>
                </div>
              </li>
            </ul>

            <div className='mt-auto pt-4 md:pt-6'>
              <Button className='w-full md:w-auto bg-white text-blue-600 hover:bg-white/90 text-xs md:text-sm font-medium'>
                Get Started
                <RiArrowRightLine className='ml-2 h-4 w-4' />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
};
