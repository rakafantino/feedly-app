import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  unit: string;
  supplier_id: string | null;
  description?: string;
  barcode?: string;
  threshold?: number; // For stock alert
  createdAt: Date;
  updatedAt: Date;
}

interface ProductStore {
  products: Product[];
  categories: string[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchProducts: () => Promise<void>;
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  
  // Stock management
  updateStock: (id: string, quantity: number, isAddition?: boolean) => Promise<void>;
  getLowStockProducts: () => Product[];
}

// Mocked implementation for now
export const useProductStore = create<ProductStore>()(
  persist(
    (set, get) => ({
      products: [],
      categories: [],
      isLoading: false,
      error: null,
      
      fetchProducts: async () => {
        set({ isLoading: true, error: null });
        try {
          // Mock API call for now
          // Will be replaced with real API call later
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // For now we'll just use some mock data
          const mockProducts: Product[] = [
            {
              id: '1',
              name: 'Pakan Ayam Premium',
              category: 'Unggas',
              price: 75000,
              stock: 50,
              unit: 'kg',
              supplier_id: '1',
              description: 'Pakan berkualitas tinggi untuk ayam broiler',
              barcode: '8991234567890',
              threshold: 10,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: '2',
              name: 'Pakan Sapi Perah',
              category: 'Ternak',
              price: 120000,
              stock: 30,
              unit: 'kg',
              supplier_id: '2',
              description: 'Pakan untuk sapi perah dengan nutrisi lengkap',
              barcode: '8991234567891',
              threshold: 5,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ];
          
          set({ 
            products: mockProducts,
            categories: Array.from(new Set(mockProducts.map(p => p.category))),
            isLoading: false 
          });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to fetch products',
            isLoading: false 
          });
        }
      },
      
      addProduct: async (productData) => {
        set({ isLoading: true, error: null });
        try {
          // Mock API call
          await new Promise(resolve => setTimeout(resolve, 500));
          
          const newProduct: Product = {
            id: Date.now().toString(), // Generate a temporary ID
            ...productData,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          
          set(state => ({
            products: [...state.products, newProduct],
            categories: Array.from(new Set([...state.categories, newProduct.category])),
            isLoading: false
          }));
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to add product',
            isLoading: false 
          });
        }
      },
      
      updateProduct: async (id, productData) => {
        set({ isLoading: true, error: null });
        try {
          // Mock API call
          await new Promise(resolve => setTimeout(resolve, 500));
          
          set(state => {
            const updatedProducts = state.products.map(product => 
              product.id === id 
                ? { ...product, ...productData, updatedAt: new Date() }
                : product
            );
            
            return {
              products: updatedProducts,
              categories: Array.from(new Set(updatedProducts.map(p => p.category))),
              isLoading: false
            };
          });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to update product',
            isLoading: false 
          });
        }
      },
      
      deleteProduct: async (id) => {
        set({ isLoading: true, error: null });
        try {
          // Mock API call
          await new Promise(resolve => setTimeout(resolve, 500));
          
          set(state => {
            const filteredProducts = state.products.filter(product => product.id !== id);
            
            return {
              products: filteredProducts,
              categories: Array.from(new Set(filteredProducts.map(p => p.category))),
              isLoading: false
            };
          });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to delete product',
            isLoading: false 
          });
        }
      },
      
      updateStock: async (id, quantity, isAddition = true) => {
        set({ isLoading: true, error: null });
        try {
          // Mock API call
          await new Promise(resolve => setTimeout(resolve, 500));
          
          set(state => ({
            products: state.products.map(product => 
              product.id === id 
                ? { 
                    ...product,
                    stock: isAddition 
                      ? product.stock + quantity 
                      : product.stock - quantity,
                    updatedAt: new Date()
                  }
                : product
            ),
            isLoading: false
          }));
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to update stock',
            isLoading: false 
          });
        }
      },
      
      getLowStockProducts: () => {
        const { products } = get();
        return products.filter(product => 
          product.threshold !== undefined && product.stock <= product.threshold
        );
      },
    }),
    {
      name: 'product-storage',
    }
  )
); 