import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { get, set, del } from "idb-keyval";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
  unit: string;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updatePrice: (id: string, price: number) => void;
  clearCart: () => void;
}

// Custom storage using idb-keyval for better offline support
const cartStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const value = await get(name);
    return value || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

export const useCart = create<CartStore>()(
  persist(
    (set) => ({
      items: [],

      addItem: (newItem) => set((state) => {
        const existingItemIndex = state.items.findIndex(
          (item) => item.id === newItem.id
        );

        if (existingItemIndex >= 0) {
          const updatedItems = [...state.items];
          const existingItem = updatedItems[existingItemIndex];
          const newQuantity = Math.min(
            existingItem.quantity + newItem.quantity,
            existingItem.stock
          );

          updatedItems[existingItemIndex] = {
            ...existingItem,
            quantity: newQuantity
          };

          return { items: updatedItems };
        } else {
          const validQuantity = Math.min(newItem.quantity, newItem.stock);

          return {
            items: [
              ...state.items,
              { ...newItem, quantity: validQuantity }
            ]
          };
        }
      }),

      removeItem: (id) => set((state) => ({
        items: state.items.filter((item) => item.id !== id)
      })),

      updateQuantity: (id, quantity) => set((state) => {
        const updatedItems = state.items.map((item) => {
          if (item.id === id) {
            const validQuantity = Math.min(Math.max(0.01, quantity), item.stock);
            return { ...item, quantity: validQuantity };
          }
          return item;
        });

        return { items: updatedItems };
      }),

      updatePrice: (id, price) => set((state) => {
        const updatedItems = state.items.map((item) => {
          if (item.id === id) {
            return { ...item, price: Math.max(0, price) };
          }
          return item;
        });
        return { items: updatedItems };
      }),

      clearCart: () => set({ items: [] })
    }),
    {
      name: 'feedly-cart',
      storage: createJSONStorage(() => cartStorage),
    }
  )
); 