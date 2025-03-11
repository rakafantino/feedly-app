"use client";

import { useCallback, useEffect, useState } from "react";
import { ProductSearch } from "./components/ProductSearch";
import { Cart } from "./components/Cart";
import { CartItemType } from "./components/CartItem";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useHotkeys } from "react-hotkeys-hook";
import { BarcodeScanner } from "./components/BarcodeScanner";

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
  const [cartItems, setCartItems] = useState<CartItemType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

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
    setCartItems((prevItems) => {
      // Check if product already exists in cart
      const existingItem = prevItems.find(
        (item) => item.productId === product.id
      );

      if (existingItem) {
        // Update quantity if we have stock available
        const newQuantity = existingItem.quantity + 1;
        if (
          existingItem.maxQuantity &&
          newQuantity > existingItem.maxQuantity
        ) {
          toast.error(`Hanya tersedia ${existingItem.maxQuantity} ${product.unit}`);
          return prevItems;
        }

        return prevItems.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: newQuantity }
            : item
        );
      }

      // Add new item
      return [
        ...prevItems,
        {
          id: uuidv4(),
          productId: product.id,
          name: product.name,
          price: Number(product.price),
          quantity: 1,
          unit: product.unit,
          maxQuantity: product.stock,
        },
      ];
    });

    toast.success(`${product.name} telah ditambahkan ke keranjang.`);
  }, []);

  // Update cart item quantity
  const handleQuantityChange = useCallback((id: string, quantity: number) => {
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, quantity } : item
      )
    );
  }, []);

  // Remove item from cart
  const handleRemoveItem = useCallback((id: string) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.id !== id));
  }, []);

  // Clear cart
  const handleClearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  // Checkout
  const handleCheckout = useCallback(() => {
    if (cartItems.length === 0) return;

    toast.info("Memproses transaksi...");

    // TODO: Implement checkout logic here
    console.log("Checkout items:", cartItems);
  }, [cartItems]);

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
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container py-6 mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-120px)]">
        <div className="lg:col-span-2 space-y-4">
          <ProductSearch
            products={products}
            onProductSelect={handleAddToCart}
            onScanClick={toggleScanner}
            isLoading={isLoading}
          />
          
          {/* Products display will go here later */}
        </div>
        
        <div className="lg:col-span-1">
          <Cart
            items={cartItems}
            onQuantityChange={handleQuantityChange}
            onRemove={handleRemoveItem}
            onCheckout={handleCheckout}
            onClear={handleClearCart}
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
    </div>
  );
} 