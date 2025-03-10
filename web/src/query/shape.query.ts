import { clientFetch } from '@/query/client';
import { useCurrentWorkspaceId } from '@/lib/pathUtils';
import { useMutation } from '@tanstack/react-query';

export const useUpdateLinkShape = () => {
  const workspaceId = useCurrentWorkspaceId();

  const mutation = useMutation({
    mutationFn: async (json: { shapeId: string; url: string }) => {
      return refreshLinkShape({
        shapeId: json.shapeId,
        url: json.url,
        workspaceId,
      });
    },
  });

  return {
    updateLinkShape: mutation.mutateAsync,
    ...mutation,
  };
};

const refreshLinkShape = async (params: {
  shapeId: string;
  url: string;
  workspaceId: string;
}) => {
  const res = await clientFetch(`/workspace/${params.workspaceId}/shape/url`, {
    method: 'POST',
    body: JSON.stringify({
      shapeId: params.shapeId,
      url: params.url,
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to refresh link shape');
  }

  return res.json();
};
