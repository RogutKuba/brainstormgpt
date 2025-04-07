import { clientFetch } from '@/query/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

export const useSubscriptionStatus = () => {
  const query = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const res = await clientFetch('/account/subscription', {
        method: 'GET',
      });

      const data = (await res.json()) as {
        status: 'pro' | 'free';
        premiumUsage: number;
      };
      return data;
    },
  });

  return {
    subscription: query.data,
    ...query,
  };
};

export const useOpenBillingPortal = () => {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await clientFetch('/account/billing', {
        method: 'GET',
      });

      const data = (await res.json()) as { url: string };
      router.push(data.url);
    },
  });

  return {
    openBillingPortal: mutation.mutateAsync,
    ...mutation,
  };
};

export const useOpenNewSubscription = () => {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await clientFetch('/account/subscribe', {
        method: 'GET',
      });

      const data = (await res.json()) as { url: string };
      router.push(data.url);
    },
  });

  return {
    openNewSubscription: mutation.mutateAsync,
    ...mutation,
  };
};

export const useDeleteAccount = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await clientFetch('/account', {
        method: 'DELETE',
      });

      return res.json();
    },
    onSuccess: () => {
      queryClient.clear();
      router.push('/');
    },
  });

  return {
    deleteAccount: mutation.mutateAsync,
    ...mutation,
  };
};
