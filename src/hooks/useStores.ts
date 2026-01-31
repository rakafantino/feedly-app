// useStores.ts
// React Query hooks for stores

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface Store {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateStoreData {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

export function useStores() {
  return useQuery({
    queryKey: ['stores'],
    queryFn: async (): Promise<Store[]> => {
      const res = await fetch('/api/stores/list');
      if (!res.ok) throw new Error('Failed to fetch stores');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateStore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateStoreData) => {
      const res = await fetch('/api/stores/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create store');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      toast.success('Toko berhasil dibuat');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Gagal membuat toko');
    },
  });
}

export function useSwitchStore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storeId: string) => {
      const res = await fetch('/api/auth/switch-store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId }),
      });
      if (!res.ok) throw new Error('Failed to switch store');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      // Redirect or reload to apply the store switch
      window.location.reload();
    },
    onError: () => {
      toast.error('Gagal mengganti toko');
    },
  });
}
