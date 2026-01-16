import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  CASHIER = 'cashier'
}

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
