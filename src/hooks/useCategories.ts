// useCategories.ts
// React Query hook for categories

import { useQuery } from '@tanstack/react-query';

export interface Category {
  id: string;
  name: string;
  productCount?: number;
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async (): Promise<Category[]> => {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      const json = await res.json();
      // API returns { categories: string[], storeId: ... }
      // We need to map string[] to Category[]
      return (json.categories || []).map((name: string) => ({ 
        id: name, 
        name: name 
      }));
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}
