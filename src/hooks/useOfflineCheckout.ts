// useOfflineCheckout.ts
// Checkout hook dengan offline-first support


import { useQueryClient } from '@tanstack/react-query';
import { useCart } from '@/lib/store';
import { useStore } from '@/components/providers/store-provider';
import { queueCreate } from '@/lib/mutation-queue';
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
  transaction_number: string; // Add this to match component expectation, assuming API returns it or we map it
  storeId?: string;
}

export function useOfflineCheckout() {
  const queryClient = useQueryClient();
  const { clearCart } = useCart();
  const { selectedStore } = useStore();
  const isOnline = useOnlineStatus();

  const checkoutMutation = useOfflineMutation<CheckoutResponse, Error, CheckoutPayload, unknown>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Gagal membuat transaksi');
      }
      return res.json();
    },
    offlineFn: async (payload) => {
      const mutationId = await queueCreate('/api/transactions', {
        ...payload,
        _queueTimestamp: Date.now(),
        _storeId: selectedStore?.id,
      });
      return mutationId;
    },
    successMessage: 'Transaksi berhasil!',
    onOfflineSuccess: () => {
       clearCart();
    },
    onSuccess: async (data) => {
      // If result is from Online fetch (it's an object)
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
