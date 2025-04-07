/**
 * Redirect used to have SSOT for all redirect urls
 */
export const Redirect = {
  // this just used in case the home page url ever changes
  home: (url: string) => url,
  workspace: (url: string, workspaceCode: string) =>
    `${url}/chat/${workspaceCode}`,
  account: (url: string) => `${url}/account`,
};
