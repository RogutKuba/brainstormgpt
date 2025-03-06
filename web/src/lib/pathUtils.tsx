import { useParams } from 'next/navigation';

export const useCurrentWorkspaceId = () => {
  const params = useParams<{ workspaceId: string }>();

  if (!params.workspaceId) {
    throw new Error('Workspace ID is required');
  }

  return params.workspaceId;
};
