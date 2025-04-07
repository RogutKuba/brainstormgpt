'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  RiLogoutBoxLine,
  RiDeleteBinLine,
  RiArrowRightLine,
  RiCheckLine,
  RiAlertLine,
  RiBrain2Fill,
  RiUser3Line,
  RiVipCrownLine,
  RiSettings4Line,
} from '@remixicon/react';
import { useLogout, useUserData } from '@/query/auth.query';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { SITE_ROUTES } from '@/lib/siteConfig';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export default function AccountPage() {
  const router = useRouter();
  const { user, isLoading } = useUserData();
  const { logout } = useLogout();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Mock data - in a real app, this would come from an API
  const premiumSearchesLeft = 3;
  const isPro = false; // This would be determined by checking user subscription status

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-gray-950'>
        <div className='max-w-3xl mx-auto p-4 md:p-8'>
          <Skeleton className='h-12 w-48 mb-6' />
          <Skeleton className='h-64 w-full rounded-lg mb-6' />
          <Skeleton className='h-64 w-full rounded-lg' />
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-950'>
      <div className='max-w-3xl mx-auto p-4 md:p-8'>
        <div className='flex items-center gap-3 mb-8'>
          <RiSettings4Line className='h-6 w-6 text-blue-500' />
          <h1 className='text-2xl font-bold'>Account Settings</h1>
        </div>

        {/* Profile Card */}
        <Card className='mb-6 border border-gray-200 shadow-sm'>
          <CardHeader className='border-b border-gray-200 bg-gray-50 dark:bg-gray-900 dark:border-gray-800'>
            <div className='flex items-center gap-2'>
              <RiUser3Line className='h-5 w-5 text-gray-500' />
              <CardTitle className='text-lg'>Profile Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className='p-6'>
            <div className='flex items-center gap-4'>
              <div className='w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white text-xl font-semibold'>
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <h3 className='font-medium text-lg'>{user?.name || 'User'}</h3>
                <p className='text-gray-500'>{user?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Card */}
        <Card className='mb-6 border border-gray-200 shadow-sm'>
          <CardHeader className='border-b border-gray-200 bg-gray-50 dark:bg-gray-900 dark:border-gray-800'>
            <div className='flex items-center gap-2'>
              <RiVipCrownLine className='h-5 w-5 text-gray-500' />
              <CardTitle className='text-lg'>Subscription</CardTitle>
            </div>
          </CardHeader>
          <CardContent className='p-6'>
            <div className='flex items-center gap-3 mb-4'>
              <div
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  isPro
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {isPro ? 'Pro Plan' : 'Free Plan'}
              </div>
              {!isPro && (
                <div className='text-sm text-gray-500 flex items-center gap-1'>
                  <span className='inline-block w-2 h-2 rounded-full bg-green-500'></span>
                  {premiumSearchesLeft} premium searches left today
                </div>
              )}
            </div>

            {!isPro && (
              <div className='bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4 mb-4'>
                <div className='flex items-center gap-2 mb-3'>
                  <RiBrain2Fill className='h-5 w-5 text-blue-500' />
                  <h4 className='font-medium'>Upgrade to Pro</h4>
                </div>
                <ul className='space-y-2 mb-4 pl-7'>
                  <li className='flex items-start -ml-7'>
                    <RiCheckLine className='mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5' />
                    <span>Unlimited premium searches (web & image)</span>
                  </li>
                  <li className='flex items-start -ml-7'>
                    <RiCheckLine className='mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5' />
                    <span>File uploads (Coming Soon)</span>
                  </li>
                  <li className='flex items-start -ml-7'>
                    <RiCheckLine className='mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5' />
                    <span>Chat with your mind map (Coming Soon)</span>
                  </li>
                </ul>
                <Button
                  className='bg-blue-500 hover:bg-blue-600 text-white'
                  onClick={() => router.push(SITE_ROUTES.HOME)}
                >
                  Upgrade to Pro
                  <RiArrowRightLine className='ml-2 h-4 w-4' />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Management Card */}
        <Card className='border border-gray-200 shadow-sm'>
          <CardHeader className='border-b border-gray-200 bg-gray-50 dark:bg-gray-900 dark:border-gray-800'>
            <div className='flex items-center gap-2'>
              <RiSettings4Line className='h-5 w-5 text-gray-500' />
              <CardTitle className='text-lg'>Account Management</CardTitle>
            </div>
          </CardHeader>
          <CardContent className='p-6'>
            <div className='flex flex-col sm:flex-row gap-3'>
              <Button
                variant='secondary'
                className='flex items-center justify-center'
                onClick={() => logout()}
              >
                <RiLogoutBoxLine className='mr-2 h-5 w-5' />
                Log Out
              </Button>

              <Button
                variant='destructive'
                className='flex items-center justify-center'
                onClick={() => setShowDeleteDialog(true)}
              >
                <RiDeleteBinLine className='mr-2 h-5 w-5' />
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete your account? This action cannot
              be undone and all your data will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <div className='bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg p-4 my-4'>
            <div className='flex items-start'>
              <RiAlertLine className='h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5' />
              <p className='text-sm text-red-600 dark:text-red-400'>
                Deleting your account will remove all your workspaces, searches,
                and personal information.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='secondary'
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button variant='destructive'>Delete Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
