"use client";

import { useCallback, useEffect, useState } from "react";
import { ProductSearch } from "./components/ProductSearch";
import { Cart } from "./components/Cart";
import { CartItemType } from "./components/CartItem";
import { useCart } from "@/lib/store";
import { toast } from "sonner";
import { Loader2, ShoppingCart } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useHotkeys } from "react-hotkeys-hook";
import { BarcodeScanner } from "./components/BarcodeScanner";
import CheckoutModal from "./components/CheckoutModal";
import ProductGrid from "./components/ProductGrid";
import { CategoryFilter } from "./components/CategoryFilter";
import { Pagination } from "@/components/ui/pagination";
import { POSSkeleton } from "@/components/skeleton/POSSkeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

interface ApiResponse {
  products: Product[];
  pagination: {
    totalPages: number;
    currentPage: number;
    totalItems: number;
  };
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false); // Mobile cart state
  const [refreshKey, setRefreshKey] = useState(0); // Trigger for refreshing data
  const itemsPerPage = 12; // Jumlah produk per halaman
  
  // Menggunakan Zustand store untuk cart
  const { items: cartItems, addItem, removeItem, updateQuantity, clearCart } = useCart();

  // Fungsi untuk merefresh data produk
  const refreshProducts = useCallback(() => {
    // Increment refresh key to trigger useEffect
    setRefreshKey(prevKey => prevKey + 1);
    // Reset to page 1 when refreshing
    setCurrentPage(1);
  }, []);

  // Load products with filters and pagination
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        
        // Build query params
        const params = new URLSearchParams();
        params.append('page', currentPage.toString());
        params.append('limit', itemsPerPage.toString());
        
        if (selectedCategory) {
          params.append('category', selectedCategory);
        }
        
        if (searchQuery) {
          params.append('search', searchQuery);
        }
        
        const response = await fetch(`/api/products?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Failed to fetch products");
        }
        
        const data: ApiResponse = await response.json();
        setProducts(data.products);
        setTotalPages(data.pagination.totalPages);
      } catch (error) {
        console.error("Error fetching products:", error);
        toast.error("Gagal memuat produk. Silakan coba lagi.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [currentPage, selectedCategory, searchQuery, itemsPerPage, refreshKey]);

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
    
    // Pesan sukses untuk UX yang lebih baik
    toast.success(`${product.name} ditambahkan ke keranjang`);
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
    setIsCartOpen(false); // Close cart sheet on mobile
  }, [cartItems.length]);

  // Barcode scanner toggle
  const toggleScanner = useCallback(() => {
    setIsScannerOpen((prev) => !prev);
  }, []);

  // Change category
  const handleCategoryChange = useCallback((category: string | null) => {
    setSelectedCategory(category);
    setCurrentPage(1); // Reset to first page when changing category
  }, []);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page when searching
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

  if (isLoading && products.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <POSSkeleton />
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
  
  // Calculate total items and subtotal for the mobile cart button
  const totalItems = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-7 xl:grid-cols-7 gap-4 lg:gap-5 h-[calc(100vh-150px)]">
        {/* Products Grid - Full Width on Mobile */}
        <div className="lg:col-span-4 xl:col-span-5 space-y-4 overflow-auto pb-20 sm:pb-0">
          <div className="sticky top-0 z-10 bg-background pb-2 space-y-4">
            <div className="mx-auto w-full">
              <ProductSearch
                products={products}
                onProductSelect={handleAddToCart}
                onScanClick={toggleScanner}
                isLoading={isLoading}
                onSearch={handleSearch}
              />
            </div>
            
            {/* Category Filter */}
            <CategoryFilter 
              products={products}
              selectedCategory={selectedCategory}
              onCategoryChange={handleCategoryChange}
            />
          </div>
          
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Products Grid */}
              <ProductGrid 
                products={products}
                onProductSelect={handleAddToCart}
                selectedCategory={selectedCategory}
              />
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center my-6">
                  <Pagination 
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Desktop Cart - Hidden on Mobile */}
        <div className="lg:col-span-3 xl:col-span-2 hidden lg:block">
          <Cart
            items={cartItemsForComponent}
            onQuantityChange={handleQuantityChange}
            onRemove={handleRemoveItem}
            onCheckout={handleCheckout}
            onClear={clearCart}
          />
        </div>
      </div>

      {/* Mobile Cart Button - Fixed at Bottom */}
      <div className="lg:hidden fixed bottom-4 left-0 right-0 px-4 z-40">
        <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
          <SheetTrigger asChild>
            <Button 
              className={cn(
                "w-full py-6 flex items-center justify-between shadow-lg relative",
                totalItems > 0 ? "bg-primary text-primary-foreground" : "bg-muted"
              )}
            >
              <div className="flex items-center">
                <div className="relative mr-2">
                  <ShoppingCart className="h-5 w-5" />
                  {totalItems > 0 && (
                    <span className="absolute -top-2 -right-2 bg-white text-primary text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                      {totalItems > 99 ? '99+' : totalItems}
                    </span>
                  )}
                </div>
                <span className="font-medium">{totalItems > 0 ? "Keranjang" : "Keranjang Kosong"}</span>
              </div>
              {totalItems > 0 && (
                <span className="font-bold">
                  {new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    minimumFractionDigits: 0,
                  }).format(subtotal)}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] px-0 py-0" aria-describedby="cart-sheet-description">
            <Cart
              items={cartItemsForComponent}
              onQuantityChange={handleQuantityChange}
              onRemove={handleRemoveItem}
              onCheckout={handleCheckout}
              onClear={clearCart}
              className="h-full border-0 rounded-none shadow-none"
              onCloseCart={() => setIsCartOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Scanner Dialog */}
      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby="scanner-dialog-description">
          <DialogTitle className="sr-only">Barcode Scanner</DialogTitle>
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
        onSuccess={refreshProducts} 
      />
    </div>
  );
} 