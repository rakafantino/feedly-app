import { useQueryClient } from '@tanstack/react-query';
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
        const errorData = await res.json();
        let errorMessage = errorData.error || 'Gagal menambahkan produk';
        
        // Format validation messages
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
    successMessage: 'Produk berhasil ditambahkan',
    onOfflineSuccess: (payload) => {
       // Optimistically update the product in 'products' query
       queryClient.setQueriesData({ queryKey: ['products'] }, (oldData: any) => {
          if (!oldData || !oldData.products) return oldData;
          return {
             ...oldData,
             products: [{
                id: 'temp-' + Date.now().toString(),
                ...payload,
             }, ...oldData.products],
             pagination: {
                ...oldData.pagination,
                totalItems: (oldData.pagination?.totalItems || 0) + 1
             }
          };
       });
    },
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
        const errorData = await res.json();
        let errorMessage = errorData.error || 'Gagal memperbarui produk';
        
        // Format validation messages
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
    successMessage: 'Produk berhasil diperbarui',
    onOfflineSuccess: ({ id, payload }) => {
       // Optimistically update the product in 'products' query
       queryClient.setQueriesData({ queryKey: ['products'] }, (oldData: any) => {
          if (!oldData || !oldData.products) return oldData;
          return {
             ...oldData,
             products: oldData.products.map((p: any) => 
                p.id === id ? { ...p, ...payload } : p
             )
          };
       });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });

  return {
    createProduct: createMutation.mutateAsync,
    updateProduct: (id: string, payload: ProductPayload) => updateMutation.mutateAsync({ id, payload }),
    isOnline: !!createMutation.context, // Consider refactoring this to useOnlineStatus later
    isLoading: createMutation.isPending || updateMutation.isPending
  };
}
