// useProducts.ts
// React Query hooks for products - with optimistic updates

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Product } from '@/types/product';
import { useStore } from '@/components/providers/store-provider';
import { getCookie } from '@/lib/utils';

export interface ProductsResponse {
  products: Product[];
  pagination?: {
    totalPages: number;
    currentPage: number;
    totalItems: number;
  };
}

export interface UseProductsParams {
  page?: number;
  search?: string;
  category?: string;
  lowStock?: boolean;
  limit?: number;
  minimal?: boolean;
  enabled?: boolean;
  storeId?: string;
}

export function useProducts(params?: UseProductsParams) {
  const { page = 1, search, category, lowStock, limit = 10, minimal, enabled = true, storeId: paramStoreId } = params || {};
  
  // Get store context
  const { selectedStore } = useStore();
  // Determine effective storeId: param > context > cookie
  const effectiveStoreId = paramStoreId || selectedStore?.id || getCookie('selectedStoreId');

  return useQuery({
    queryKey: ['products', page, search, category, lowStock, limit, minimal, effectiveStoreId],
    queryFn: async (): Promise<ProductsResponse> => {
      const searchParams = new URLSearchParams();
      searchParams.set('page', page.toString());
      searchParams.set('limit', limit.toString());
      if (search) searchParams.set('search', search);
      if (category) searchParams.set('category', category);
      if (lowStock) searchParams.set('lowStock', 'true');
      if (minimal) searchParams.set('minimal', 'true');
      if (effectiveStoreId) searchParams.set('storeId', effectiveStoreId);
      
      const res = await fetch(`/api/products?${searchParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
    enabled,
    staleTime: 30 * 1000, // Cache for 30 seconds
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: async (): Promise<Product> => {
      const res = await fetch(`/api/products/${id}`);
      if (!res.ok) throw new Error('Failed to fetch product');
      return res.json();
    },
    enabled: !!id,
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete product');
      return res.json();
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['products'] });
      const previousProducts = queryClient.getQueryData(['products']);

      queryClient.setQueryData(['products'], (old: ProductsResponse | undefined) => {
        if (!old?.products) return old;
        return {
          ...old,
          products: old.products.filter((p: Product) => p.id !== id)
        };
      });

      return { previousProducts };
    },
    onError: (err, id, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(['products'], context.previousProducts);
      }
      toast.error('Gagal menghapus produk');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useSyncStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      const res = await fetch(`/api/products/${productId}/sync-stock`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to sync stock');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-analytics'] });
      toast.success('Stok berhasil disinkronkan');
    },
    onError: () => {
      toast.error('Gagal sinkronkan stok');
    },
  });
}

export function useConvertInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      productId: string;
      quantity: number;
      unit: string;
      convertedUnit?: string;
      convertFromBatch?: boolean;
    }) => {
      const res = await fetch('/api/inventory/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceProductId: payload.productId,
          quantity: payload.quantity,
        }),
      });
      if (!res.ok) throw new Error('Gagal konversi inventaris');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Konversi berhasil');
    },
    onError: () => {
      toast.error('Gagal konversi inventaris');
    },
  });
}

export function useSetupRetail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      productId: string;
      convertFromBatch: boolean;
      retailProductName: string;
      retailProductPrice: number;
      quantityPerUnit: number;
      convertImmediately: boolean;
    }) => {
      const res = await fetch('/api/inventory/setup-retail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to setup retail');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produk eceran berhasil disiapkan');
    },
    onError: () => {
      toast.error('Gagal menyiapkan produk eceran');
    },
  });
}
