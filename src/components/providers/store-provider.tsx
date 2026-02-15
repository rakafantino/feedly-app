"use client";

import React, { createContext, useContext, useEffect, useRef } from 'react';
import { useStoreStore } from '@/store/useStoreStore';
import { useCartStore } from '@/store';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';

interface StoreContextType {
  selectedStore: any;
  isLoading: boolean;
  storeName?: string;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { selectedStore, isLoading, setSelectedStore } = useStoreStore();
  const { status } = useSession();
  const isAuthenticated = status === 'authenticated';
  const queryClient = useQueryClient();

  // Saat provider dimuat, fetch active store dari API (karena cookie HttpOnly)
  useEffect(() => {
    if (!isAuthenticated) return;

    fetch('/api/stores/active')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('No active store');
      })
      .then(data => {
        if (data?.store) {
          setSelectedStore(data.store);
          console.log(`[StoreProvider] Initialized with store: ${data.store.name}`);
        }
      })
      .catch(() => {
        // Silent error likely means no store selected yet
        // console.warn('[StoreProvider] Failed to fetch active store');
      });
  }, [isAuthenticated, setSelectedStore]);

  // Reset cart & refresh products saat store berubah
  const prevStoreIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isAuthenticated) return;

    const currentStoreId = selectedStore?.id || null;

    // Inisialisasi pertama: set prev dan lakukan fetch produk
    if (prevStoreIdRef.current === null) {
      prevStoreIdRef.current = currentStoreId;
      // Products are handled by React Query, no manual fetch needed
      return;
    }

    // Jika store berubah, kosongkan cart dan refresh produk
    if (currentStoreId && prevStoreIdRef.current !== currentStoreId) {
      try {
        useCartStore.getState().clearCart();
        console.log('[StoreProvider] Cart cleared due to store change');
        
        // RESET QUERIES instead of INVALIDATE
        // This forces React Query to discard current data immediately and show loading state
        // Invalidate just marks as stale but keeps showing old data until refetch finishes
        queryClient.resetQueries(); 
        console.log('[StoreProvider] All queries reset due to store change');
        
      } catch (e) {
        console.error('[StoreProvider] Failed to clear cart on store change:', e);
      }

      // Products are now handled by React Query with storeId as part of the key
      // So checking invalidation might be needed elsewhere (e.g. via queryClient), 
      // but simplistic store hydration is no longer needed.

      prevStoreIdRef.current = currentStoreId;
    }
  }, [isAuthenticated, selectedStore?.id, queryClient]);

  const contextValue = {
    selectedStore: selectedStore || null,
    isLoading: !selectedStore && isLoading,
    storeName: selectedStore?.name
  };

  return (
    <StoreContext.Provider value={contextValue}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return context;
}