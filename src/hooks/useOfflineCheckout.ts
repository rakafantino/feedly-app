// useOfflineCheckout.ts
// Checkout hook dengan offline-first support

import { useQueryClient } from '@tanstack/react-query';
import { useCart } from '@/lib/store';
import { useStore } from '@/components/providers/store-provider';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineMutation } from '@/hooks/useOfflineMutation';

interface CheckoutPayload {
  items: Array<{ productId: string; quantity: number; price: number }>;
  paymentMethod: string;
  paymentDetails: Array<{ method: string; amount: number; cashGiven?: number; change?: number }>;
  customerId?: string;
  amountPaid: number;
  dueDate?: Date;
  discount: number;
}

interface CheckoutResponse {
  id: string;
  invoice_number: string;
  transaction_number: string;
  storeId?: string;
}

export function useOfflineCheckout() {
  const queryClient = useQueryClient();
  const { clearCart } = useCart();
  const { selectedStore } = useStore();
  const isOnline = useOnlineStatus();

  const checkoutMutation = useOfflineMutation<CheckoutResponse, Error, CheckoutPayload, unknown>({
    mutationFn: async (payload) => {
      // Add required metadata for offline sync tracking in backend if it's ever needed
      const normalizedPayload = {
        ...payload,
        _queueTimestamp: Date.now(),
        _storeId: selectedStore?.id,
      };

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizedPayload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Gagal membuat transaksi');
      }
      return res.json();
    },
    successMessage: 'Transaksi berhasil!',
    onOfflineSuccess: (payload) => {
       // Optimistic Stock Reduction for POS
       const reduceStock = (oldData: any) => {
          if (!oldData || !oldData.products) return oldData;
          return {
             ...oldData,
             products: oldData.products.map((product: any) => {
                const purchasedItem = payload.items.find(i => i.productId === product.id);
                if (purchasedItem) {
                   return { ...product, stock: Math.max(0, product.stock - purchasedItem.quantity) };
                }
                return product;
             })
          };
       };

       queryClient.setQueriesData({ queryKey: ['products'] }, reduceStock);
       queryClient.setQueriesData({ queryKey: ['pos-products'] }, reduceStock);

       clearCart();
    },
    onSuccess: async (data) => {
      // If result is from Online fetch (it's an object, not the OFFLINE string)
      if (typeof data !== 'string') {
        clearCart();

        if (selectedStore?.id) {
            fetch('/api/stock-alerts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storeId: selectedStore.id, forceCheck: true }),
            }).catch(console.error);
        }

        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['products'] }),
            queryClient.invalidateQueries({ queryKey: ['stock-analytics'] }),
            queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] }),
            queryClient.invalidateQueries({ queryKey: ['pos-products'] }),
            queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        ]);
      }
    },
  });

  return { 
    checkout: checkoutMutation.mutateAsync, 
    isOnline,
    isLoading: checkoutMutation.isPending
  };
}
