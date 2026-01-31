// usePOS.ts
// React Query hooks for POS - products and checkout

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCart } from '@/lib/store';
import { toast } from 'sonner';
import { useStore } from '@/components/providers/store-provider';

// Product types (matching page.tsx)
interface Product {
  id: string;
  name: string;
  barcode?: string | null;
  category?: string | null;
  price: number;
  stock: number;
  unit: string;
  min_selling_price?: number | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

interface ApiResponse {
  products: Product[];
  pagination: {
    totalPages: number;
    currentPage: number;
    totalItems: number;
  };
}

// Product hooks
export function usePOSProducts(params: {
  currentPage: number;
  searchQuery: string;
  selectedCategory: string | null;
}) {
  const { currentPage, searchQuery, selectedCategory } = params;

  return useQuery({
    queryKey: ['pos-products', currentPage, searchQuery, selectedCategory],
    queryFn: async (): Promise<ApiResponse> => {
      const params = new URLSearchParams();
      params.set('page', currentPage.toString());
      params.set('limit', '12');
      if (searchQuery) params.set('search', searchQuery);
      if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory);

      const res = await fetch(`/api/products?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json();
    },
    staleTime: 30 * 1000, // Cache for 30 seconds
  });
}

export function useLastCustomerPrice(customerId: string, productId: string) {
  return useQuery({
    queryKey: ['last-price', customerId, productId],
    queryFn: async (): Promise<{ price: number | null }> => {
      const res = await fetch(`/api/customers/${customerId}/last-price?productId=${productId}`);
      if (!res.ok) throw new Error('Failed to fetch last price');
      return res.json();
    },
    enabled: !!customerId && !!productId,
  });
}

// Checkout hook with optimistic cart clear
export function useCheckout() {
  const queryClient = useQueryClient();
  const { clearCart } = useCart();
  const { selectedStore } = useStore();

  return useMutation({
    mutationFn: async (payload: {
      items: Array<{ productId: string; quantity: number; price: number }>;
      paymentMethod: string;
      paymentDetails: Array<{ method: string; amount: number; cashGiven?: number; change?: number }>;
      customerId?: string;
      amountPaid: number;
      dueDate?: Date;
      discount: number;
    }) => {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Gagal membuat transaksi');
      return res.json();
    },
    onMutate: () => {
      // Optimistically clear cart immediately
      clearCart();
    },
    onSuccess: async (response) => {
      toast.success('Transaksi berhasil!');

      // Trigger stock alert refresh (non-blocking)
      if (selectedStore?.id) {
        fetch('/api/stock-alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storeId: selectedStore.id, forceCheck: true }),
        }).catch(console.error);
      }

      // Invalidate queries for fresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['stock-analytics'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] }),
        queryClient.invalidateQueries({ queryKey: ['pos-products'] }),
      ]);

      return response;
    },
    onError: (error) => {
      // Note: Cart is already cleared optimistically
      // In a real app, you might want to restore cart from context
      toast.error('Terjadi kesalahan saat checkout');
      console.error('Checkout error:', error);
    },
  });
}

// Helper hook to add product to cart with last price
export function useAddToCart() {
  const { addItem } = useCart();

  return useMutation({
    mutationFn: async ({ product, customer }: { product: Product; customer: Customer | null }) => {
      let finalPrice = product.price;
      let priceSource = 'default';

      if (customer) {
        try {
          const res = await fetch(`/api/customers/${customer.id}/last-price?productId=${product.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.price !== null && data.price !== undefined) {
              finalPrice = data.price;
              priceSource = 'history';
            }
          }
        } catch (err) {
          console.error('Failed to fetch last price', err);
        }
      }

      // Enforce minimum selling price
      const minPrice = product.min_selling_price || 0;
      const hitMinPrice = finalPrice < minPrice;
      if (hitMinPrice) finalPrice = minPrice;

      return { finalPrice, priceSource, hitMinPrice };
    },
    onSuccess: (data, { product }) => {
      addItem({
        id: product.id,
        name: product.name,
        price: data.finalPrice,
        quantity: 1,
        stock: product.stock,
        unit: product.unit,
      });

      if (data.hitMinPrice) {
        toast.warning(`Harga disesuaikan ke minimum: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(data.finalPrice)}`);
      } else if (data.priceSource === 'history') {
        toast.success(`Produk ditambahkan. Menggunakan harga terakhir: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(data.finalPrice)}`);
      } else {
        toast.success('Produk ditambahkan');
      }
    },
  });
}
