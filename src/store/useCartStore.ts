import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  updateItemQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      
      addItem: (item: CartItem) => {
        const { items } = get();
        const existingItem = items.find((i) => i.id === item.id);
        
        if (existingItem) {
          set({
            items: items.map((i) => 
              i.id === item.id 
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
            ),
          });
        } else {
          set({ items: [...items, item] });
        }
      },
      
      updateItemQuantity: (id: string, quantity: number) => {
        const { items } = get();
        
        set({
          items: items.map((item) => 
            item.id === id 
              ? { ...item, quantity }
              : item
          ),
        });
      },
      
      removeItem: (id: string) => {
        const { items } = get();
        set({ items: items.filter((item) => item.id !== id) });
      },
      
      clearCart: () => {
        set({ items: [] });
      },
      
      total: () => {
        const { items } = get();
        return items.reduce((total, item) => total + (item.price * item.quantity), 0);
      },
    }),
    {
      name: 'cart-storage',
    }
  )
); 