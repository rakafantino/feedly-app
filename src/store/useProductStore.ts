import { create } from 'zustand';
import { Product } from '@prisma/client';

interface ProductState {
  getLowStockProducts: (products: Product[]) => Product[];
}

export const useProductStore = create<ProductState>(() => ({
  getLowStockProducts: (products: Product[]) => {
    return products.filter((p) => p.stock <= (p.threshold || 0));
  }
}));
