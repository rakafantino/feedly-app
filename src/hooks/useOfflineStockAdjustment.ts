
import { useQueryClient } from '@tanstack/react-query';
import { queueCreate } from '@/lib/mutation-queue';
import { useOfflineMutation } from '@/hooks/useOfflineMutation';

interface StockAdjustmentPayload {
  storeId: string;
  productId: string;
  batchId: string | null;
  quantity: number;
  type: string;
  reason: string;
}

interface StockAdjustmentResponse {
  id: string;
  message: string;
}

export function useOfflineStockAdjustment() {
  const queryClient = useQueryClient();

  const adjustMutation = useOfflineMutation<StockAdjustmentResponse, Error, StockAdjustmentPayload, unknown>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/inventory/adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Gagal menyimpan penyesuaian');
      }
      return res.json();
    },
    offlineFn: (payload) => queueCreate('/api/inventory/adjustment', payload as unknown as Record<string, unknown>),
    successMessage: 'Penyesuaian stok berhasil disimpan',
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['stock-analytics'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });

  return { 
    adjust: adjustMutation.mutateAsync, 
    isOnline: !!adjustMutation.context,
    isLoading: adjustMutation.isPending
  };
}
