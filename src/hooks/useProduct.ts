import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

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

export function useProduct() {
  const queryClient = useQueryClient();

  const createMutation = useMutation<ProductResponse, Error, ProductPayload>({
    mutationFn: async (payload) => {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        let errorMessage = errorData.error || 'Gagal menambahkan produk';
        
        if (errorData.details && typeof errorData.details === 'object') {
          const detailMessages = Object.entries(errorData.details)
            .map(([, msgs]) => Array.isArray(msgs) ? msgs[0] : msgs)
            .join(', ');
          if (detailMessages) errorMessage = detailMessages;
        }
        
        throw new Error(errorMessage);
      }
      return res.json();
    },
    onSuccess: async () => {
      toast.success('Produk berhasil ditambahkan');
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  const updateMutation = useMutation<ProductResponse, Error, { id: string; payload: ProductPayload }>({
    mutationFn: async ({ id, payload }) => {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        let errorMessage = errorData.error || 'Gagal memperbarui produk';
        
        if (errorData.details && typeof errorData.details === 'object') {
          const detailMessages = Object.entries(errorData.details)
            .map(([, msgs]) => Array.isArray(msgs) ? msgs[0] : msgs)
            .join(', ');
          if (detailMessages) errorMessage = detailMessages;
        }
        
        throw new Error(errorMessage);
      }
      return res.json();
    },
    onSuccess: async () => {
      toast.success('Produk berhasil diperbarui');
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  return {
    createProduct: createMutation.mutateAsync,
    updateProduct: (id: string, payload: ProductPayload) => updateMutation.mutateAsync({ id, payload }),
    isLoading: createMutation.isPending || updateMutation.isPending
  };
}
