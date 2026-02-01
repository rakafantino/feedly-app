import { get, set, clear } from 'idb-keyval';
import type { Persister, PersistedClient } from '@tanstack/react-query-persist-client';

// Create async storage persister using IndexedDB (idb-keyval)
// This enables TanStack Query to cache API responses for offline access
export function createQueryPersister(
  key: string = 'feedly-query-cache'
): Persister {
  return {
    // Restore cached data from IndexedDB
    persistClient: async (persistClient: PersistedClient): Promise<void> => {
      await set(key, persistClient);
    },
    
    // Retrieve cached data from IndexedDB
    restoreClient: async (): Promise<PersistedClient | undefined> => {
      return await get(key);
    },
    
    // Remove cached data from IndexedDB
    removeClient: async (): Promise<void> => {
      await clear();
    },
  };
}

// Query keys that should be cached for offline access
// These are read-only queries that can be safely cached
export const CACHEABLE_QUERIES = {
  PRODUCTS: ['products'] as const,
  CUSTOMERS: ['customers'] as const,
  SUPPLIERS: ['suppliers'] as const,
  TRANSACTIONS: ['transactions'] as const,
  DASHBOARD: ['dashboard'] as const,
  ANALYTICS: ['analytics'] as const,
  CATEGORIES: ['categories'] as const,
  STORES: ['stores'] as const,
  EXPENSES: ['expenses'] as const,
  PURCHASE_ORDERS: ['purchase-orders'] as const,
  LOW_STOCK: ['products', 'low-stock'] as const,
  STOCK_ALERTS: ['stock-alerts'] as const,
} as const;

// Cache configuration per query type
export const CACHE_CONFIG = {
  // Products and inventory - cache for 5 minutes
  products: {
    maxAge: 1000 * 60 * 5,
    staleTime: 1000 * 60 * 5,
  },
  
  // Dashboard and analytics - cache for 1 minute (real-time ish)
  dashboard: {
    maxAge: 1000 * 60,
    staleTime: 1000 * 30,
  },
  
  // Static reference data - cache for 30 minutes
  reference: {
    maxAge: 1000 * 60 * 30,
    staleTime: 1000 * 60 * 30,
  },
  
  // Transactions - cache for 2 minutes
  transactions: {
    maxAge: 1000 * 60 * 2,
    staleTime: 1000 * 60,
  },
} as const;

// Helper to get cache config for a query key
export function getCacheConfig(queryKey: readonly unknown[]): {
  maxAge: number;
  staleTime: number;
} {
  const key = queryKey[0]?.toString() || '';
  
  if (key === 'dashboard' || key === 'analytics') {
    return CACHE_CONFIG.dashboard;
  }
  
  if (key === 'products' || key === 'transactions') {
    return CACHE_CONFIG[key as keyof typeof CACHE_CONFIG] || CACHE_CONFIG.products;
  }
  
  if (['customers', 'suppliers', 'categories', 'stores', 'expenses', 'purchase-orders'].includes(key)) {
    return CACHE_CONFIG.reference;
  }
  
  // Default cache config
  return {
    maxAge: 1000 * 60 * 5,
    staleTime: 1000 * 60 * 5,
  };
}
