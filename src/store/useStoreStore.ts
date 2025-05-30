import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface Store {
  id: string;
  name?: string;
  address?: string;
  phone?: string;
}

interface StoreState {
  selectedStore: Store | null;
  isLoading: boolean;
  setSelectedStore: (store: Store | null) => void;
  clearSelectedStore: () => void;
  setLoading: (loading: boolean) => void;
}

export const useStoreStore = create<StoreState>()(
  persist(
    (set) => ({
      selectedStore: null,
      isLoading: false,
      setSelectedStore: (store) => set({ selectedStore: store }),
      clearSelectedStore: () => set({ selectedStore: null }),
      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'store-storage',
      storage: createJSONStorage(() => sessionStorage),
      // Hanya simpan selectedStore
      partialize: (state) => ({ selectedStore: state.selectedStore }),
    }
  )
); 