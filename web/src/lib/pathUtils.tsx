import { useParams } from 'next/navigation';

export const useCurrentWorkspaceCode = () => {
  const params = useParams<{ workspaceCode: string }>();

  if (!params.workspaceCode) {
    throw new Error('Workspace Code is required');
  }

  return params.workspaceCode;
};
