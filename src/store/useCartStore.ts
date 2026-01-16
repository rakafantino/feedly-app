import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  unit?: string;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      total: 0,
      addItem: (item) => {
        const items = get().items;
        const existingItem = items.find((i) => i.productId === item.productId);
        
        if (existingItem) {
          const updatedItems = items.map((i) => 
            i.productId === item.productId 
              ? { ...i, quantity: i.quantity + item.quantity }
              : i
          );
          set({ items: updatedItems });
        } else {
          set({ items: [...items, item] });
        }
      },
      removeItem: (itemId) => {
        set({ items: get().items.filter((i) => i.id !== itemId) });
      },
      updateQuantity: (itemId, quantity) => {
        set({ 
          items: get().items.map((i) => 
            i.id === itemId ? { ...i, quantity } : i
          )
        });
      },
      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'cart-storage',
    }
  )
);
