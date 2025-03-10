import { clientFetch } from '@/query/client';
import { useCurrentWorkspaceId } from '@/lib/pathUtils';
import { useMutation } from '@tanstack/react-query';

export const useUpdateLinkShape = () => {
  const workspaceId = useCurrentWorkspaceId();

  const mutation = useMutation({
    mutationFn: async (json: { shapeId: string; url: string }) => {
      const res = await clientFetch(`/workspace/${workspaceId}/shape/url`, {
        method: 'POST',
        body: JSON.stringify(json),
      });

      if (!res.ok) {
        throw new Error('Failed to update link shape');
      }

      return res.json();
    },
  });

  return {
    updateLinkShape: mutation.mutateAsync,
    ...mutation,
  };
};
