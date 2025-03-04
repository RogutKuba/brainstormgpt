const PROD_URL = 'https://brainstorm-worker.soft-sea-86fd.workers.dev';

export const API_URL = (() => {
  // return PROD_URL;
  const processEnv = process.env.NEXT_PUBLIC_API_URL;
  if (!processEnv) {
    return PROD_URL;
  }
  return processEnv;
})();
