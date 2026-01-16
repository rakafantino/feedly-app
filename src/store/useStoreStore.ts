import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Store {
  id: string;
  name?: string;
  [key: string]: any;
}

interface StoreState {
  selectedStore: Store | null;
  isLoading: boolean;
  setSelectedStore: (store: Store | null) => void;
  setIsLoading: (loading: boolean) => void;
}

export const useStoreStore = create<StoreState>()(
  persist(
    (set) => ({
      selectedStore: null,
      isLoading: false,
      setSelectedStore: (store) => set({ selectedStore: store }),
      setIsLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'store-storage',
    }
  )
);
