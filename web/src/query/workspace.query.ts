import { clientFetch } from '@/query/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useMutation } from '@tanstack/react-query';

type WorkspaceEntity = {
  id: string;
  createdAt: string;
  ownerId: string;
  name: string;
  goalPrompt: string | null;
};

export const useWorkspaces = () => {
  const query = useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const response = await clientFetch('/workspace');

      if (!response.ok) {
        throw new Error('Failed to fetch workspaces');
      }

      return response.json() as Promise<WorkspaceEntity[]>;
    },
  });

  return {
    workspaces: query.data,
    ...query,
  };
};

export const useCreateWorkspace = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: { name: string; goalPrompt: string }) => {
      const response = await clientFetch('/workspace', {
        method: 'POST',
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error('Failed to create workspace');
      }

      return response.json() as Promise<WorkspaceEntity>;
    },
    onSuccess: (newWorkspace) => {
      queryClient.setQueryData(
        ['workspaces'],
        (old: WorkspaceEntity[] | undefined) => [...(old ?? []), newWorkspace]
      );
    },
  });

  return {
    createWorkspace: mutation.mutateAsync,
    ...mutation,
  };
};

export const useSendMessage = () => {
  const mutation = useMutation({
    mutationFn: async (params: {
      workspaceId: string;
      message: string;
      chatHistory: { content: string; sender: 'user' | 'system' }[];
      selectedItems: string[];
      predictionId: string | null;
    }) => {
      const response = await clientFetch(
        `/workspace/${params.workspaceId}/chat`,
        {
          method: 'POST',
          body: JSON.stringify(params),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      return response.json() as Promise<{
        message: string;
      }>;
    },
  });

  return {
    sendMessage: mutation.mutateAsync,
    ...mutation,
  };
};
