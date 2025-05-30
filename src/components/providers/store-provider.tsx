"use client";

import React, { createContext, useContext, useEffect } from 'react';
import { useStoreStore } from '@/store/useStoreStore';
import { useAuthStore } from '@/store';
import { getCookie } from '@/lib/utils';

interface StoreContextType {
  selectedStore: any;
  isLoading: boolean;
  storeName?: string;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { selectedStore, isLoading, setSelectedStore } = useStoreStore();
  const { isAuthenticated } = useAuthStore();

  // Saat provider dimuat, cek cookie untuk storeId yang dipilih
  useEffect(() => {
    if (!isAuthenticated) return;

    const selectedStoreId = getCookie('selectedStoreId');
    
    if (selectedStoreId) {
      // Set selected store di state
      setSelectedStore({ id: selectedStoreId });
      
      console.log(`[StoreProvider] Initialized with store ID: ${selectedStoreId}`);
    }
  }, [isAuthenticated, setSelectedStore]);

  const contextValue = {
    selectedStore,
    isLoading,
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
  if (!context) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return context;
} 