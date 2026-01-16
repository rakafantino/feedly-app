import { useQuery } from '@tanstack/react-query';
import { Product } from '@/types/product';
import { useStoreStore } from '@/store/useStoreStore';

interface ProductsResponse {
  products: Product[];
  pagination: {
    total: number;
    pages: number;
    page: number;
    limit: number;
  };
}

interface UseProductsOptions {
  page?: number;
  search?: string;
  category?: string;
  enabled?: boolean;
}

export function useProducts({ page = 1, search = '', category = '', enabled = true }: UseProductsOptions = {}) {
  const { selectedStore } = useStoreStore();
  const storeId = selectedStore?.id;

  return useQuery<ProductsResponse>({
    queryKey: ['products', storeId, page, search, category],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      queryParams.append('page', page.toString());
      if (search) queryParams.append('search', search);
      if (category) queryParams.append('category', category);
      if (storeId) queryParams.append('storeId', storeId);

      const response = await fetch(`/api/products?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      return response.json();
    },
    enabled: enabled,
    placeholderData: (previousData) => previousData, // Keep previous data while fetching new data to prevent layout shift
  });
}
