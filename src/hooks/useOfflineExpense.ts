// useOfflineExpense.ts
// Expense CRUD dengan offline-first support

import { useQueryClient } from "@tanstack/react-query";
import { useOfflineMutation } from "@/hooks/useOfflineMutation";

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

interface ExpenseData {
  expenses: ExpenseResponse[];
  pagination?: {
    totalItems: number;
  };
}

export function useOfflineExpense() {
  const queryClient = useQueryClient();

  const createMutation = useOfflineMutation<ExpenseResponse, Error, ExpensePayload, unknown>({
    mutationFn: async (payload) => {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Gagal menambahkan pengeluaran");
      }
      return res.json();
    },
    successMessage: "Pengeluaran berhasil ditambahkan",
    offlineMessage: "Pengeluaran diantrikan! Akan disinkronkan saat koneksi kembali.",
    onOfflineSuccess: (payload) => {
      queryClient.setQueriesData({ queryKey: ["expenses"] }, (oldData: ExpenseData | undefined) => {
        if (!oldData || !oldData.expenses) return oldData;
        const tempExpense = {
          id: "temp-" + Date.now().toString(),
          ...payload,
          createdAt: new Date().toISOString(),
        };
        return {
          ...oldData,
          expenses: [tempExpense, ...oldData.expenses],
          pagination: {
            ...oldData.pagination,
            totalItems: (oldData.pagination?.totalItems || 0) + 1,
          },
        };
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["reports-financial"] });
    },
  });

  const updateMutation = useOfflineMutation<ExpenseResponse, Error, { id: string; payload: ExpensePayload }, unknown>({
    mutationFn: async ({ id, payload }) => {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Gagal memperbarui pengeluaran");
      }
      return res.json();
    },
    successMessage: "Pengeluaran berhasil diperbarui",
    offlineMessage: "Perubahan pengeluaran diantrikan!",
    onOfflineSuccess: ({ id, payload }) => {
      queryClient.setQueriesData({ queryKey: ["expenses"] }, (oldData: ExpenseData | undefined) => {
        if (!oldData || !oldData.expenses) return oldData;
        return {
          ...oldData,
          expenses: oldData.expenses.map((expense) => (expense.id === id ? { ...expense, ...payload } : expense)),
        };
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });

  return {
    createExpense: createMutation.mutateAsync,
    updateExpense: (id: string, payload: ExpensePayload) => updateMutation.mutateAsync({ id, payload }),
    isOnline: !!createMutation.context,
    isLoading: createMutation.isPending || updateMutation.isPending,
  };
}
