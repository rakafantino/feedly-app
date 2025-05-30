import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type UserRole = 'ADMIN' | 'CASHIER' | 'MANAGER' | 'admin' | 'kasir' | 'manager';

interface AuthState {
  isAuthenticated: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    storeId?: string;
    storeName?: string;
  } | null;
  selectedStoreId: string | null;
  login: (userData: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    storeId?: string;
    storeName?: string;
  }, token: string) => void;
  setAuth: (
    isAuth: boolean,
    userData?: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      storeId?: string;
      storeName?: string;
    }
  ) => void;
  clearAuth: () => void;
  setSelectedStore: (storeId: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      selectedStoreId: null,
      login: (userData) => 
        set({
          isAuthenticated: true,
          user: userData,
          selectedStoreId: userData?.storeId || null,
        }),
      setAuth: (isAuth, userData) =>
        set({
          isAuthenticated: isAuth,
          user: userData || null,
          // Set selectedStoreId dari user data jika ada
          selectedStoreId: userData?.storeId || null,
        }),
      clearAuth: () =>
        set({
          isAuthenticated: false,
          user: null,
          selectedStoreId: null,
        }),
      setSelectedStore: (storeId) =>
        set({
          selectedStoreId: storeId,
        }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
); 