import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCart } from '@/lib/store';
import { useStore } from '@/components/providers/store-provider';

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

export function useCheckout() {
  const queryClient = useQueryClient();
  const { clearCart } = useCart();
  const { selectedStore } = useStore();

  const checkoutMutation = useMutation<CheckoutResponse, Error, CheckoutPayload>({
    mutationFn: async (payload) => {
      const normalizedPayload = {
        ...payload,
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
    onSuccess: async () => {
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
    },
  });

  return { 
    checkout: checkoutMutation.mutateAsync, 
    isLoading: checkoutMutation.isPending
  };
}
