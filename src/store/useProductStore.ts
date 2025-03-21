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
          // Ambil semua produk dari API bukan data dummy
          const response = await fetch('/api/products?limit=100');
          
          if (!response.ok) {
            throw new Error('Failed to fetch products');
          }
          
          const data = await response.json();
          const products = data.products.map((product: any) => ({
            ...product,
            createdAt: new Date(product.createdAt),
            updatedAt: new Date(product.updatedAt),
            // Memastikan threshold dikonversi ke angka jika tersedia
            threshold: product.threshold !== null ? Number(product.threshold) : undefined
          }));
          
          set({ 
            products: products,
            categories: Array.from(new Set(products.map((p: any) => p.category).filter(Boolean))) as string[],
            isLoading: false 
          });
          
          console.log('Fetched products:', products);
          console.log('Low stock products:', get().getLowStockProducts());
        } catch (error) {
          console.error('Error fetching products:', error);
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
        
        // Debug info
        console.log('Current products:', products);
        console.log('Products with thresholds:', products.filter(p => p.threshold !== undefined && p.threshold !== null));
        
        // Filter produk dengan threshold dan stok di bawah threshold
        // Pastikan threshold dikonversi ke number dan nilai yang valid
        const lowStockProducts = products.filter(product => {
          // Jika threshold undefined atau null, produk tidak termasuk low stock
          if (product.threshold === undefined || product.threshold === null) {
            return false;
          }
          
          // Konversi ke number jika perlu
          const numericThreshold = typeof product.threshold === 'string' 
            ? parseFloat(product.threshold) 
            : product.threshold;
            
          // Handle nilai threshold yang tidak valid (NaN)
          if (isNaN(numericThreshold)) {
            return false;
          }
          
          // Bandingkan stok dengan threshold
          return product.stock <= numericThreshold;
        });
        
        console.log('Found low stock products:', lowStockProducts);
        return lowStockProducts;
      },
    }),
    {
      name: 'product-storage',
    }
  )
); 