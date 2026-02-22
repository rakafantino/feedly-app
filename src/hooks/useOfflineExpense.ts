// useOfflineExpense.ts
// Expense CRUD dengan offline-first support

import { useQueryClient } from '@tanstack/react-query';
import { useOfflineMutation } from '@/hooks/useOfflineMutation';

interface ExpensePayload {
  amount: number;
  category: string;
  description?: string;
  date: Date;
}

interface ExpenseResponse {
  id: string;
  message: string;
}

export function useOfflineExpense() {
  const queryClient = useQueryClient();

  const createMutation = useOfflineMutation<ExpenseResponse, Error, ExpensePayload, unknown>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Gagal menambahkan pengeluaran');
      }
      return res.json();
    },
    successMessage: 'Pengeluaran berhasil ditambahkan',
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
      await queryClient.invalidateQueries({ queryKey: ['reports-financial'] });
    },
  });

  const updateMutation = useOfflineMutation<ExpenseResponse, Error, { id: string; payload: ExpensePayload }, unknown>({
    mutationFn: async ({ id, payload }) => {
      const res = await fetch(`/api/expenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Gagal memperbarui pengeluaran');
      }
      return res.json();
    },
    successMessage: 'Pengeluaran berhasil diperbarui',
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });

  return { 
    createExpense: createMutation.mutateAsync, 
    updateExpense: (id: string, payload: ExpensePayload) => updateMutation.mutateAsync({ id, payload }),
    isOnline: !!createMutation.context,
    isLoading: createMutation.isPending || updateMutation.isPending
  };
}
