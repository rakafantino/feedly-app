// useStockAdjustment.ts
// React Query hooks for stock adjustments - with optimistic updates

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface StockAdjustmentPayload {
  storeId: string;
  productId: string;
  batchId: string | null;
  quantity: number;
  type: string;
  reason: string;
}

export function useStockAdjustment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: StockAdjustmentPayload) => {
      const response = await fetch('/api/inventory/adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Gagal menyimpan penyesuaian');
      }

      return response.json();
    },
    onMutate: async (payload) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['products'] });
      await queryClient.cancelQueries({ queryKey: ['stock-analytics'] });
      await queryClient.cancelQueries({ queryKey: ['dashboard-stats'] });

      // Snapshot previous values
      const previousProducts = queryClient.getQueryData(['products']);
      const previousStockAnalytics = queryClient.getQueryData(['stock-analytics']);
      const previousDashboardStats = queryClient.getQueryData(['dashboard-stats']);

      // Optimistically update the product stock
      queryClient.setQueryData(['products'], (old: any) => {
        if (!old?.products) return old;
        return {
          ...old,
          products: old.products.map((p: any) => {
            if (p.id === payload.productId) {
              return {
                ...p,
                stock: Math.max(0, p.stock + payload.quantity)
              };
            }
            return p;
          })
        };
      });

      return { previousProducts, previousStockAnalytics, previousDashboardStats };
    },
    onError: (err, payload, context) => {
      // Rollback on error
      if (context?.previousProducts) {
        queryClient.setQueryData(['products'], context.previousProducts);
      }
      if (context?.previousStockAnalytics) {
        queryClient.setQueryData(['stock-analytics'], context.previousStockAnalytics);
      }
      if (context?.previousDashboardStats) {
        queryClient.setQueryData(['dashboard-stats'], context.previousDashboardStats);
      }
      toast.error(err.message || 'Gagal menyimpan penyesuaian');
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}
