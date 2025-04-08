import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { clientFetch } from './client';
import { SITE_ROUTES } from '@/lib/siteConfig';

export const useUserData = (params?: { shouldRedirect?: boolean }) => {
  const router = useRouter();

  const query = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      try {
        const res = await clientFetch('/auth/current-user');

        if (res.ok) {
          const data = await res.json();
          return data as {
            id: string;
            createdAt: string;
            email: string;
            name: string;
            imageUrl: string | null;
          };
        } else {
          // if status is 401 or 403, redirect to login
          if (
            params?.shouldRedirect !== false &&
            (res.status === 401 || res.status === 403)
          ) {
            router.push(SITE_ROUTES.LOGIN);
          }

          return null;
        }
      } catch (error) {
        console.error(error);
        router.push(SITE_ROUTES.HOME);
        return null;
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
        router.push(SITE_ROUTES.HOME);
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
