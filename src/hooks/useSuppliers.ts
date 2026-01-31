// useSuppliers.ts
// React Query hooks for suppliers - with optimistic updates

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Supplier } from '@/app/(dashboard)/suppliers/components/columns';

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async (): Promise<Supplier[]> => {
      const res = await fetch("/api/suppliers");
      if (!res.ok) throw new Error("Failed to fetch suppliers");
      const json = await res.json();
      return json.suppliers || [];
    },
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Supplier>) => {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create supplier');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Supplier> }) => {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update supplier');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete supplier');
      return res.json();
    },
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['suppliers'] });

      // Snapshot previous value
      const previousSuppliers = queryClient.getQueryData(['suppliers']);

      // Optimistically update to remove the supplier
      queryClient.setQueryData(['suppliers'], (old: Supplier[] | undefined) => {
        return old?.filter(s => s.id !== id) || [];
      });

      return { previousSuppliers };
    },
    onError: (err, id, context) => {
      // Rollback on error
      if (context?.previousSuppliers) {
        queryClient.setQueryData(['suppliers'], context.previousSuppliers);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}
