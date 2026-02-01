
import { useQueryClient } from '@tanstack/react-query';
import { queueCreate, queueUpdate } from '@/lib/mutation-queue';
import { useOfflineMutation } from '@/hooks/useOfflineMutation';

interface ProductPayload {
  name: string;
  product_code?: string | null;
  description?: string;
  barcode?: string | null;
  category?: string | null;
  price: number;
  stock: number;
  unit: string;
  threshold?: number | null;
  purchase_price?: number | null;
  min_selling_price?: number | null;
  batch_number?: string | null;
  expiry_date?: Date | null;
  purchase_date?: Date | null;
  supplierId?: string | null;
  conversionTargetId?: string | null;
  conversionRate?: number | null;
  hpp_calculation_details?: Record<string, unknown> | null;
}

interface ProductResponse {
  id: string;
  name: string;
  product_code?: string;
}

export function useOfflineProduct() {
  const queryClient = useQueryClient();

  const createMutation = useOfflineMutation<ProductResponse, Error, ProductPayload, unknown>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Gagal menambahkan produk');
      }
      return res.json();
    },
    offlineFn: (payload) => queueCreate('/api/products', payload as unknown as Record<string, unknown>),
    successMessage: 'Produk berhasil ditambahkan',
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
    },
  });

  const updateMutation = useOfflineMutation<ProductResponse, Error, { id: string; payload: ProductPayload }, unknown>({
    mutationFn: async ({ id, payload }) => {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Gagal memperbarui produk');
      }
      return res.json();
    },
    offlineFn: ({ id, payload }) => queueUpdate(`/api/products/${id}`, payload as unknown as Record<string, unknown>),
    successMessage: 'Produk berhasil diperbarui',
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  return {
    createProduct: createMutation.mutateAsync,
    updateProduct: (id: string, payload: ProductPayload) => updateMutation.mutateAsync({ id, payload }),
    isOnline: !!createMutation.context, // This is a bit hacky, but valid for now, or we can export useOnlineStatus from hook
    isLoading: createMutation.isPending || updateMutation.isPending
  };
}
