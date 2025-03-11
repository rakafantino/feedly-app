import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'manager' | 'cashier';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      accessToken: null,
      
      login: (user: User, token: string) => {
        set({
          user,
          isAuthenticated: true,
          accessToken: token,
        });
      },
      
      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          accessToken: null,
        });
      },
      
      updateUser: (userData: Partial<User>) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        }));
      },
    }),
    {
      name: 'auth-storage',
    }
  )
); 