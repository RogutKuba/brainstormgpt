import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { clientFetch } from './client';

export const useUserData = (params?: { shouldRedirect?: boolean }) => {
  const router = useRouter();
  const query = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      const res = await clientFetch('/auth/current-user');

      if (res.ok) {
        const data = await res.json();
        return data as {
          id: string;
          createdAt: string;
          email: string;
          name: string;
        };
      } else {
        // if status is 401 or 403, redirect to login
        if (res.status === 401 || res.status === 403) {
          router.push('/app/login');
        }

        return undefined;
      }
    },
  });

  return {
    user: query.data,
    ...query,
  };
};

export const useLogout = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await clientFetch('/auth/logout');

      if (res.ok) {
        queryClient.clear();
        router.push('/app/login');
      } else {
        return null;
      }
    },
  });

  return {
    logout: mutation.mutateAsync,
    ...mutation,
  };
};
