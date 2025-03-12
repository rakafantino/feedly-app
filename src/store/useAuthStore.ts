import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'CASHIER' | 'MANAGER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  login: (user: User, accessToken: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      accessToken: null,
      login: (user, accessToken) => set({
        user,
        isAuthenticated: true,
        accessToken,
      }),
      logout: () => {
        // Clear persisted state
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth-storage');
          // Tambahkan ini untuk memastikan semua storage auth dihapus
          sessionStorage.removeItem('auth-storage');
        }
        set({
          user: null,
          isAuthenticated: false,
          accessToken: null,
        });
      },
      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null,
      })),
    }),
    {
      name: 'auth-storage',
      version: 1,
      // Tambahkan partialize untuk hanya menyimpan data yang dibutuhkan
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken,
      }),
    }
  )
); 