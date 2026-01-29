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
  limit?: number;
  search?: string;
  category?: string;
  lowStock?: boolean;
  minimal?: boolean;
  enabled?: boolean;
}

export function useProducts({ 
  page = 1, 
  limit = 10,
  search = '', 
  category = '', 
  lowStock = false,
  minimal = false,
  enabled = true 
}: UseProductsOptions = {}) {
  const { selectedStore } = useStoreStore();
  const storeId = selectedStore?.id;

  return useQuery<ProductsResponse>({
    queryKey: ['products', storeId, page, limit, search, category, lowStock, minimal],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      queryParams.append('page', page.toString());
      queryParams.append('limit', limit.toString());
      if (search) queryParams.append('search', search);
      if (category) queryParams.append('category', category);
      if (lowStock) queryParams.append('lowStock', 'true');
      if (minimal) queryParams.append('minimal', 'true');
      if (storeId) queryParams.append('storeId', storeId);

      const response = await fetch(`/api/products?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      return response.json();
    },
    enabled: enabled,
    placeholderData: (previousData) => previousData, // Keep previous data while fetching new data
  });
}
