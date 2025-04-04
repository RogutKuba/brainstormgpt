import { useCurrentWorkspaceCode } from '@/lib/pathUtils';
import { clientFetch } from '@/query/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { useState, useCallback } from 'react';

type WorkspaceEntity = {
  id: string;
  createdAt: string;
  ownerId: string;
  name: string;
  goalPrompt: string | null;
  code: string;
  isPublic: boolean;
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
    mutationFn: async (params: { prompt: string }) => {
      const response = await clientFetch('/workspace', {
        method: 'POST',
        body: JSON.stringify(params),
        headers: {
          'Content-Type': 'application/json',
        },
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

export const useCreateAnonWorkspace = () => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<WorkspaceEntity | null>(null);

  const createAnonWorkspace = useCallback(
    async (params: { prompt: string }) => {
      setIsPending(true);
      setError(null);

      try {
        const response = await clientFetch('/workspace/anonymous', {
          method: 'POST',
          body: JSON.stringify(params),
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to create anonymous workspace');
        }

        const result = (await response.json()) as WorkspaceEntity;
        setData(result);
        return result;
      } catch (err) {
        const errorObj =
          err instanceof Error ? err : new Error('Unknown error occurred');
        setError(errorObj);
        throw errorObj;
      } finally {
        setIsPending(false);
      }
    },
    []
  );

  return {
    createAnonWorkspace,
    isPending,
    error,
    data,
  };
};

export const useSendMessage = () => {
  const mutation = useMutation({
    mutationFn: async (params: {
      workspaceCode: string;
      message: string;
      chatHistory: { content: string; sender: 'user' | 'system' }[];
      selectedItems: string[];
      predictionId: string | null;
    }) => {
      const response = await clientFetch(
        `/workspace/${params.workspaceCode}/chat`,
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

export const useWorkspaceStatus = () => {
  const workspaceCode = useCurrentWorkspaceCode();

  const query = useQuery({
    queryKey: ['workspaceStatus'],
    queryFn: async () => {
      try {
        const response = await clientFetch(
          `/workspace/${workspaceCode}/connect/status`
        );

        if (!response.ok) {
          // handle different 400 errors
          if (response.status === 401 || response.status === 403) {
            return {
              status: 'error',
              error: 'Unauthorized to access workspace',
            };
          } else if (response.status === 404) {
            return {
              status: 'error',
              error: 'Workspace not found',
            };
          }

          return {
            status: 'error',
            error: 'Failed to fetch workspace status',
          };
        }

        return response.json() as Promise<{ status: 'ok'; error: null }>;
      } catch (error) {
        return {
          status: 'error',
          error: 'Failed to fetch workspace status',
        };
      }
    },
    retry: (failureCount, _) => {
      if (failureCount >= 2) {
        return false;
      }

      return true;
    },
  });

  return {
    workspaceStatus: query.data,
    ...query,
  };
};

export const useDeleteWorkspace = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (workspaceCode: string) => {
      const response = await clientFetch(`/workspace/${workspaceCode}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete workspace');
      }

      return response.json() as Promise<WorkspaceEntity>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(
        ['workspaces'],
        (old: WorkspaceEntity[] | undefined) =>
          old?.filter((workspace) => workspace.id !== data.id)
      );
    },
    meta: {
      SUCCESS_MESSAGE: 'Workspace deleted successfully',
    },
  });

  return {
    deleteWorkspace: mutation.mutateAsync,
    ...mutation,
  };
};

export const useUpdateWorkspace = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: {
      workspaceCode: string;
      name?: string;
      isPublic?: boolean;
    }) => {
      const response = await clientFetch(`/workspace/${params.workspaceCode}`, {
        method: 'PUT',
        body: JSON.stringify(params),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to update workspace');
      }

      return response.json() as Promise<WorkspaceEntity>;
    },
    onMutate: async (params) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ['workspaces'] });

      // Snapshot the previous value
      const previousWorkspaces = queryClient.getQueryData<WorkspaceEntity[]>([
        'workspaces',
      ]);

      // Optimistically update the cache
      if (previousWorkspaces) {
        queryClient.setQueryData<WorkspaceEntity[]>(
          ['workspaces'],
          previousWorkspaces.map((workspace) =>
            workspace.code === params.workspaceCode
              ? {
                  ...workspace,
                  name: params.name ?? workspace.name,
                  isPublic: params.isPublic ?? workspace.isPublic,
                }
              : workspace
          )
        );
      }

      // Return context with the snapshotted value
      return { previousWorkspaces };
    },
    onError: (err, variables, context) => {
      // If the mutation fails, use the context we returned above to roll back
      if (context?.previousWorkspaces) {
        queryClient.setQueryData(['workspaces'], context.previousWorkspaces);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure cache is in sync with server
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
    meta: {
      SUCCESS_MESSAGE: 'Workspace updated successfully',
    },
  });

  return {
    updateWorkspace: mutation.mutateAsync,
    ...mutation,
  };
};
