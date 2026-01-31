// useCustomers.ts
// React Query hooks for customers - with optimistic updates

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Customer } from '@/app/(dashboard)/customers/components/columns';

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async (): Promise<Customer[]> => {
      const res = await fetch(`/api/customers`);
      if (!res.ok) throw new Error("Failed to fetch customers");
      const json = await res.json();
      return Array.isArray(json) ? json : (json.customers || []);
    },
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<Customer>) => {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create customer');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Customer> }) => {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update customer');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete customer');
      return res.json();
    },
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['customers'] });

      // Snapshot previous value
      const previousCustomers = queryClient.getQueryData(['customers']);

      // Optimistically update to remove the customer
      queryClient.setQueryData(['customers'], (old: Customer[] | undefined) => {
        return old?.filter(c => c.id !== id) || [];
      });

      return { previousCustomers };
    },
    onError: (err, id, context) => {
      // Rollback on error
      if (context?.previousCustomers) {
        queryClient.setQueryData(['customers'], context.previousCustomers);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}
