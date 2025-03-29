'use client';

import { motion } from 'motion/react';
import {
  RiBrain2Fill,
  RiArrowRightLine,
  RiCheckLine,
  RiStarFill,
} from '@remixicon/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LandingHeader } from '@/components/landing/Header';

export default function AboutPage() {
  return (
    <div className='min-h-screen bg-gradient-to-b from-blue-500 via-blue-400 to-blue-500 text-white overflow-hidden relative'>
      {/* Background decorative elements */}
      <div className='absolute top-20 left-10 w-64 h-64 bg-white/5 rounded-full blur-3xl'></div>
      <div className='absolute bottom-20 right-10 w-80 h-80 bg-white/5 rounded-full blur-3xl'></div>

      <div className='w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 relative z-10'>
        <LandingHeader />

        {/* Main Content */}
        <motion.div
          className='text-center mb-12'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className='text-4xl sm:text-5xl md:text-6xl font-medium mb-4 tracking-tight'>
            About Tangent
          </h1>
          <p className='text-lg max-w-2xl mx-auto text-white/90 mb-8'>
            Explore ideas, discover connections, and follow your curiosity with
            our AI-powered knowledge exploration tool.
          </p>
        </motion.div>

        {/* About Section */}
        <motion.div
          className='max-w-3xl mx-auto mb-16 bg-white/10 backdrop-blur-md rounded-xl p-8 shadow-lg border border-white/20'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h2 className='text-2xl font-semibold mb-4'>Our Mission</h2>
          <p className='mb-6 text-white/90'>
            Tangent was created to transform how people explore knowledge and
            ideas. We believe that learning should be intuitive, interconnected,
            and driven by natural curiosity. Our AI-powered platform helps you
            discover new concepts, make unexpected connections, and dive deeper
            into topics that interest you.
          </p>
          <h2 className='text-2xl font-semibold mb-4'>How It Works</h2>
          <p className='text-white/90'>
            Simply ask a question or share a link, and Tangent will help you
            explore related concepts, find connections between ideas, and
            discover new perspectives. Our AI analyzes content, generates
            insights, and creates a personalized knowledge map that evolves with
            your interests.
          </p>
        </motion.div>

        {/* Pricing Section */}
        <motion.div
          className='mb-16'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <h2 className='text-3xl font-semibold text-center mb-8'>
            Pricing Plans
          </h2>
          <div className='grid md:grid-cols-2 gap-8 max-w-4xl mx-auto'>
            {/* Free Plan */}
            <Card className='bg-white/10 backdrop-blur-md border-white/20 text-white overflow-hidden'>
              <CardHeader className='pb-2'>
                <CardTitle className='text-2xl font-bold'>Free</CardTitle>
                <p className='text-4xl font-bold mt-2'>
                  $0<span className='text-lg font-normal'>/month</span>
                </p>
                <p className='text-white/70 mt-2'>
                  Perfect for casual exploration
                </p>
              </CardHeader>
              <CardContent>
                <ul className='space-y-3 mt-4'>
                  <li className='flex items-center'>
                    <RiCheckLine className='mr-2 h-5 w-5 text-green-400' />
                    <span>5 questions per day</span>
                  </li>
                  <li className='flex items-center'>
                    <RiCheckLine className='mr-2 h-5 w-5 text-green-400' />
                    <span>Basic knowledge exploration</span>
                  </li>
                  <li className='flex items-center'>
                    <RiCheckLine className='mr-2 h-5 w-5 text-green-400' />
                    <span>Link analysis</span>
                  </li>
                  <li className='flex items-center'>
                    <RiCheckLine className='mr-2 h-5 w-5 text-green-400' />
                    <span>Standard response time</span>
                  </li>
                </ul>
                <Button className='w-full mt-8 bg-white text-blue-500 hover:bg-white/90'>
                  Get Started
                  <RiArrowRightLine className='ml-2 h-4 w-4' />
                </Button>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className='bg-blue-600 backdrop-blur-md border-white/30 text-white overflow-hidden relative'>
              <div className='absolute top-0 right-0 bg-yellow-400 text-blue-900 px-3 py-1 text-sm font-medium rounded-bl-lg'>
                <div className='flex items-center'>
                  <RiStarFill className='mr-1 h-4 w-4' />
                  Popular
                </div>
              </div>
              <CardHeader className='pb-2'>
                <CardTitle className='text-2xl font-bold'>Pro</CardTitle>
                <p className='text-4xl font-bold mt-2'>
                  $12<span className='text-lg font-normal'>/month</span>
                </p>
                <p className='text-white/70 mt-2'>
                  For serious knowledge explorers
                </p>
              </CardHeader>
              <CardContent>
                <ul className='space-y-3 mt-4'>
                  <li className='flex items-center'>
                    <RiCheckLine className='mr-2 h-5 w-5 text-green-400' />
                    <span>Unlimited questions</span>
                  </li>
                  <li className='flex items-center'>
                    <RiCheckLine className='mr-2 h-5 w-5 text-green-400' />
                    <span>Advanced knowledge mapping</span>
                  </li>
                  <li className='flex items-center'>
                    <RiCheckLine className='mr-2 h-5 w-5 text-green-400' />
                    <span>Deep content analysis</span>
                  </li>
                  <li className='flex items-center'>
                    <RiCheckLine className='mr-2 h-5 w-5 text-green-400' />
                    <span>Priority response time</span>
                  </li>
                  <li className='flex items-center'>
                    <RiCheckLine className='mr-2 h-5 w-5 text-green-400' />
                    <span>Custom workspaces</span>
                  </li>
                  <li className='flex items-center'>
                    <RiCheckLine className='mr-2 h-5 w-5 text-green-400' />
                    <span>Export and sharing options</span>
                  </li>
                </ul>
                <Button className='w-full mt-8 bg-white text-blue-600 hover:bg-white/90'>
                  Upgrade to Pro
                  <RiArrowRightLine className='ml-2 h-4 w-4' />
                </Button>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* FAQ or Contact Section */}
        <motion.div
          className='max-w-3xl mx-auto text-center'
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <h2 className='text-2xl font-semibold mb-4'>Have Questions?</h2>
          <p className='mb-6 text-white/90'>
            We're here to help! Contact our support team for assistance or to
            learn more about Tangent.
          </p>
          <Button className='bg-white text-blue-500 hover:bg-white/90'>
            Contact Support
          </Button>
        </motion.div>

        {/* Footer */}
        <div className='text-center mt-16 text-sm text-white/70'>
          <p>© 2024 Tangent AI. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
