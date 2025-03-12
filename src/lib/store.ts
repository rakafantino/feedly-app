import { create } from "zustand";


export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
}

export const useCart = create<CartStore>((set) => ({
  items: [],
  
  addItem: (newItem) => set((state) => {
    // Check if item already exists in cart
    const existingItemIndex = state.items.findIndex(
      (item) => item.id === newItem.id
    );

    if (existingItemIndex >= 0) {
      // Update existing item quantity
      const updatedItems = [...state.items];
      const existingItem = updatedItems[existingItemIndex];
      
      // Calculate new quantity, ensuring it doesn't exceed stock
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
      // Add new item, ensuring quantity doesn't exceed stock
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
        // Ensure quantity doesn't exceed stock
        const validQuantity = Math.min(Math.max(1, quantity), item.stock);
        return { ...item, quantity: validQuantity };
      }
      return item;
    });
    
    return { items: updatedItems };
  }),
  
  clearCart: () => set({ items: [] })
})); 