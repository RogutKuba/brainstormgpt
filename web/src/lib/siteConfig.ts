export const SITE_ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/app',
  ACCOUNT: '/account',
  // Chat routes
  CHAT: (workspaceCode: string) => `/chat/${workspaceCode}`,
  NEW_CHAT: '/chat/new',
};
