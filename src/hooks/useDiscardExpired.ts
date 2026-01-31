// useDiscardExpired.ts
// React Query hook for discarding expired stock - with optimistic updates

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface DiscardPayload {
  storeId: string;
  productId: string;
  batchId?: string;
  quantity: number;
  type: 'EXPIRED';
  reason: string;
}

export function useDiscardExpired() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: DiscardPayload) => {
      const response = await fetch('/api/inventory/adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Gagal memusnahkan stok');
      }

      return response.json();
    },
    onMutate: async (payload) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['products'] });
      await queryClient.cancelQueries({ queryKey: ['stock-analytics'] });
      await queryClient.cancelQueries({ queryKey: ['expiry-items'] });
      await queryClient.cancelQueries({ queryKey: ['expiring-products'] });

      // Snapshot previous values
      const previousProducts = queryClient.getQueryData(['products']);
      const previousStockAnalytics = queryClient.getQueryData(['stock-analytics']);
      const previousExpiryItems = queryClient.getQueryData(['expiry-items']);
      const previousExpiringProducts = queryClient.getQueryData(['expiring-products']);

      // Optimistically update: reduce stock of the product
      queryClient.setQueryData(['products'], (old: any) => {
        if (!old?.products) return old;
        return {
          ...old,
          products: old.products.map((p: any) => {
            if (p.id === payload.productId) {
              return {
                ...p,
                stock: Math.max(0, p.stock - Math.abs(payload.quantity))
              };
            }
            return p;
          })
        };
      });

      return { 
        previousProducts, 
        previousStockAnalytics,
        previousExpiryItems,
        previousExpiringProducts 
      };
    },
    onError: (err, payload, context) => {
      // Rollback on error
      if (context?.previousProducts) {
        queryClient.setQueryData(['products'], context.previousProducts);
      }
      if (context?.previousStockAnalytics) {
        queryClient.setQueryData(['stock-analytics'], context.previousStockAnalytics);
      }
      if (context?.previousExpiryItems) {
        queryClient.setQueryData(['expiry-items'], context.previousExpiryItems);
      }
      if (context?.previousExpiringProducts) {
        queryClient.setQueryData(['expiring-products'], context.previousExpiringProducts);
      }
      toast.error(err.message || 'Gagal memusnahkan stok');
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['expiry-items'] });
      queryClient.invalidateQueries({ queryKey: ['expiring-products'] });
    },
  });
}
