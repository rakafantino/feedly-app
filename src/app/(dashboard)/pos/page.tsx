"use client";

import { useCallback, useEffect, useState } from "react";
import { ProductSearch } from "./components/ProductSearch";
import { Cart } from "./components/Cart";
import { CartItemType } from "./components/CartItem";
import { useCart } from "@/lib/store";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useHotkeys } from "react-hotkeys-hook";
import { BarcodeScanner } from "./components/BarcodeScanner";
import CheckoutModal from "./components/CheckoutModal";

// Definisikan tipe Product karena tidak bisa mengimpor dari Prisma
interface Product {
  id: string;
  name: string;
  barcode?: string | null;
  category?: string | null;
  price: number;
  stock: number;
  unit: string;
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  
  // Menggunakan Zustand store untuk cart
  const { items: cartItems, addItem, removeItem, updateQuantity, clearCart } = useCart();

  // Load products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/products");
        if (!response.ok) {
          throw new Error("Failed to fetch products");
        }
        const data = await response.json();
        setProducts(data);
      } catch (error) {
        console.error("Error fetching products:", error);
        toast.error("Gagal memuat produk. Silakan coba lagi.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Add item to cart
  const handleAddToCart = useCallback((product: Product) => {
    // Validasi stok
    if (product.stock <= 0) {
      toast.error(`Stok ${product.name} kosong`);
      return;
    }

    // Menambahkan ke cart menggunakan Zustand store
    addItem({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      quantity: 1,
      stock: product.stock
    });

    toast.success(`${product.name} telah ditambahkan ke keranjang.`);
  }, [addItem]);

  // Update cart item quantity
  const handleQuantityChange = useCallback((id: string, quantity: number) => {
    updateQuantity(id, quantity);
  }, [updateQuantity]);

  // Remove item from cart
  const handleRemoveItem = useCallback((id: string) => {
    removeItem(id);
  }, [removeItem]);

  // Checkout
  const handleCheckout = useCallback(() => {
    if (cartItems.length === 0) {
      toast.error("Keranjang kosong");
      return;
    }
    setIsCheckoutOpen(true);
  }, [cartItems.length]);

  // Barcode scanner toggle
  const toggleScanner = useCallback(() => {
    setIsScannerOpen((prev) => !prev);
  }, []);

  // Keyboard shortcuts
  useHotkeys("f1", (event: KeyboardEvent) => {
    event.preventDefault();
    toggleScanner();
  });

  // Handle barcode scan result
  const handleScan = useCallback(
    (barcode: string) => {
      const foundProduct = products.find(
        (product) => product.barcode === barcode
      );

      if (foundProduct) {
        handleAddToCart(foundProduct);
        setIsScannerOpen(false);
      } else {
        toast.error(`Tidak ada produk dengan barcode ${barcode}`);
      }
    },
    [products, handleAddToCart]
  );

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Convert Zustand cart items to CartItemType for our Cart component
  const cartItemsForComponent: CartItemType[] = cartItems.map(item => ({
    id: item.id,
    productId: item.id,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    unit: "pcs", // Default unit if not available
    maxQuantity: item.stock
  }));

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-150px)]">
        <div className="lg:col-span-2 space-y-4 overflow-auto">
          <div className="sticky top-0 z-10 bg-background pb-2">
            <ProductSearch
              products={products}
              onProductSelect={handleAddToCart}
              onScanClick={toggleScanner}
              isLoading={isLoading}
            />
          </div>
          
          {/* Products display will go here later */}
        </div>
        
        <div className="lg:col-span-1">
          <Cart
            items={cartItemsForComponent}
            onQuantityChange={handleQuantityChange}
            onRemove={handleRemoveItem}
            onCheckout={handleCheckout}
            onClear={clearCart}
          />
        </div>
      </div>

      {/* Scanner Dialog */}
      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="sm:max-w-md">
          {isScannerOpen && (
            <BarcodeScanner 
              isOpen={isScannerOpen}
              onClose={() => setIsScannerOpen(false)}
              onScan={handleScan}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout Modal */}
      <CheckoutModal 
        isOpen={isCheckoutOpen} 
        onClose={() => setIsCheckoutOpen(false)} 
      />
    </div>
  );
} 