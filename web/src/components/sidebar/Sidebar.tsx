'use client';

import { useUserData } from '@/query/auth.query';
import { LoggedInSidebar } from './LoggedinSidebar';
import { AnonSidebar } from './AnonSidebar';

export const Sidebar = () => {
  const { user } = useUserData({
    shouldRedirect: false,
  });

  // Render the appropriate sidebar based on authentication status
  return user ? <LoggedInSidebar /> : <AnonSidebar />;
};
