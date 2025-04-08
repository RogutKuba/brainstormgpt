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
  RiWalletLine,
} from '@remixicon/react';
import { useLogout, useUserData } from '@/query/auth.query';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  useDeleteAccount,
  useOpenBillingPortal,
  useOpenNewSubscription,
  useSubscriptionStatus,
} from '@/query/account.query';
import { Divider } from '@/components/ui/divider';
import { ProgressCircle } from '@/components/ui/progresscircle';

export default function AccountPage() {
  const { user, isLoading: isUserLoading } = useUserData();
  const { logout } = useLogout();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { openNewSubscription, isPending: isNewSubscriptionOpen } =
    useOpenNewSubscription();
  const { openBillingPortal, isPending: isBillingPortalOpen } =
    useOpenBillingPortal();
  const { deleteAccount, isPending: isDeleting } = useDeleteAccount();

  // Get subscription status from the API
  const { subscription, isLoading: isSubscriptionLoading } =
    useSubscriptionStatus();

  // Determine if user is on pro plan
  const isPro = subscription?.status === 'pro';

  // Get premium searches left (will be -1 for pro users, indicating unlimited)
  const premiumSearchesLimit = 5;
  const premiumSearchesLeft =
    premiumSearchesLimit - (subscription?.premiumUsage ?? 0);
  const percentage = Math.round(
    (premiumSearchesLeft / premiumSearchesLimit) * 100
  );
  const variant = (() => {
    if (premiumSearchesLeft <= 0) return 'error';
    if (premiumSearchesLeft <= 2) return 'warning';
    return 'success';
  })();

  // Show loading state if either user or subscription data is loading
  const isLoading = isUserLoading || isSubscriptionLoading;

  if (isLoading) {
    return (
      <div className='min-h-screen bg-neutral-50 dark:bg-neutral-950'>
        <div className='max-w-3xl mx-auto p-4 md:p-8'>
          <Skeleton className='h-12 w-48 mb-6' />
          <Skeleton className='h-64 w-full mb-6' />
          <Skeleton className='h-64 w-full' />
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-neutral-50 dark:bg-neutral-950'>
      <div className='max-w-3xl mx-auto p-4 md:p-8'>
        {/* Header Section */}
        <h1 className='text-2xl font-medium mb-6'>Account Settings</h1>

        <Divider />

        {/* Profile Information */}
        <div>
          <h2 className='text-lg font-medium mb-4'>Profile</h2>
          <div className='flex items-center gap-5'>
            <div className='w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-xl font-semibold shadow-md'>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <h3 className='font-medium text-xl mb-1'>
                {user?.name || 'User'}
              </h3>
              <p className='text-neutral-500 dark:text-neutral-400'>
                {user?.email}
              </p>
            </div>
          </div>
        </div>

        <Divider />

        {/* Subscription */}
        <div>
          <h2 className='text-lg font-medium mb-4'>Subscription</h2>
          <div className='flex items-center gap-3 mb-4'>
            <div
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                isPro
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-neutral-200 text-neutral-900'
              }`}
            >
              {isPro ? 'Pro Plan' : 'Free Plan'}
            </div>
            {!isPro ? (
              <div className='text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5'>
                <ProgressCircle
                  value={percentage}
                  variant={variant}
                  strokeWidth={10}
                  className='w-4 h-4'
                />
                {premiumSearchesLeft} premium searches left today
              </div>
            ) : null}
          </div>

          {isPro ? (
            <div className='mt-4'>
              <Button
                variant='secondary'
                onClick={() => openBillingPortal()}
                disabled={isBillingPortalOpen}
              >
                <RiWalletLine className='h-4 w-4' />
                Manage Subscription
              </Button>
            </div>
          ) : (
            <div className='bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-100 dark:border-blue-800 rounded-lg p-6 mb-4'>
              <div className='flex items-center gap-3 mb-4'>
                <div className='rounded-full bg-blue-500 p-2 text-white'>
                  <RiBrain2Fill className='h-5 w-5' />
                </div>
                <h4 className='font-medium text-lg'>Upgrade to Pro</h4>
              </div>
              <ul className='space-y-3 mb-5'>
                <li className='flex items-start'>
                  <RiCheckLine className='mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5' />
                  <span>Unlimited premium searches (web & image)</span>
                </li>
                <li className='flex items-start'>
                  <RiCheckLine className='mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5' />
                  <span>File uploads (Coming Soon)</span>
                </li>
                <li className='flex items-start'>
                  <RiCheckLine className='mr-2 h-5 w-5 text-green-500 flex-shrink-0 mt-0.5' />
                  <span>Chat with your mind map (Coming Soon)</span>
                </li>
              </ul>
              <Button
                className='bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg transition-all'
                onClick={() => openNewSubscription()}
                disabled={isNewSubscriptionOpen}
              >
                Upgrade to Pro
                <RiArrowRightLine className='ml-2 h-4 w-4' />
              </Button>
            </div>
          )}
        </div>

        <Divider />

        {/* Account Management */}
        <div>
          <h2 className='text-lg font-medium mb-4'>Account Management</h2>
          <div className='flex flex-col sm:flex-row gap-3'>
            <Button variant='secondary' onClick={() => logout()}>
              <RiLogoutBoxLine className='h-4 w-4' />
              Log Out
            </Button>

            <Button
              variant='destructive'
              onClick={() => setShowDeleteDialog(true)}
            >
              <RiDeleteBinLine className='h-4 w-4' />
              Delete Account
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className='text-xl'>Delete Account</DialogTitle>
            <DialogDescription className='text-neutral-500 dark:text-neutral-400 mt-2'>
              Are you sure you want to delete your account? This action cannot
              be undone and all your data will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <div className='bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg p-4 my-4'>
            <div className='flex items-start'>
              <RiAlertLine className='h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5' />
              <p className='text-sm text-red-600 dark:text-red-400'>
                Deleting your account will remove all your chats, searches, and
                personal information.
              </p>
            </div>
          </div>
          <DialogFooter className='flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2'>
            <Button
              variant='secondary'
              onClick={() => setShowDeleteDialog(false)}
              className='mt-3 sm:mt-0'
            >
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={() => deleteAccount()}
              disabled={isDeleting}
              className='bg-red-500 hover:bg-red-600'
            >
              {isDeleting ? (
                <>
                  <span className='mr-2'>Deleting</span>
                  <span className='animate-pulse'>...</span>
                </>
              ) : (
                'Delete Account'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
