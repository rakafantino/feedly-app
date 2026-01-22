"use client";

import { useCallback, useEffect, useState } from "react";
import { ProductSearch } from "./components/ProductSearch";
import { Cart } from "./components/Cart";
import { useCart } from "@/lib/store";
import { toast } from "sonner";
import { Loader2, ShoppingCart } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { BarcodeScanner } from "./components/BarcodeScanner";
import CheckoutModal from "./components/CheckoutModal";
import ProductGrid from "./components/ProductGrid";
import { CategoryFilter } from "./components/CategoryFilter";
import { Pagination } from "@/components/ui/pagination";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CustomerSelector } from "./components/CustomerSelector";

// Definisikan tipe Product karena tidak bisa mengimpor dari Prisma
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

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false); // Mobile cart sheet

  const { items: cartItems, addItem, removeItem, updateQuantity, updatePrice, clearCart } = useCart();

  // Calculate subtotal for mobile button
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalCartItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set('page', currentPage.toString());
      params.set('limit', '12');
      if (searchQuery) params.set('search', searchQuery);
      if (selectedCategory && selectedCategory !== 'all') params.set('category', selectedCategory);

      const res = await fetch(`/api/products?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch products');

      const data: ApiResponse = await res.json();
      setProducts(data.products || []);
      if (data.pagination) {
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      toast.error("Gagal memuat produk");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, searchQuery, selectedCategory]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Handlers
  const handleAddToCart = async (product: Product) => {
    let finalPrice = product.price;
    let priceSource = 'default';

    if (selectedCustomer) {
      try {
        const res = await fetch(`/api/customers/${selectedCustomer.id}/last-price?productId=${product.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.price !== null && data.price !== undefined) {
            finalPrice = data.price;
            priceSource = 'history';
            // Visual feedback handled by toast below or specialized UI
          }
        }
      } catch (err) {
        console.error("Failed to fetch last price", err);
      }
    }

    // Enforce Minimum Selling Price
    const minPrice = product.min_selling_price || 0;
    let hitMinPrice = false;

    if (finalPrice < minPrice) {
      finalPrice = minPrice;
      hitMinPrice = true;
    }

    addItem({
      id: product.id,
      name: product.name,
      price: finalPrice,
      quantity: 1,
      stock: product.stock,
      unit: product.unit
    });

    if (hitMinPrice) {
      toast.warning(`Harga disesuaikan ke minimum: ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(finalPrice)}`);
    } else if (priceSource === 'history') {
      toast.success(`Produk ditambahkan. Menggunakan harga terakhir: ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(finalPrice)}`);
    } else {
      toast.success("Produk ditambahkan");
    }
  };

  const handleRemoveItem = (id: string) => {
    removeItem(id);
  };

  const handleQuantityChange = (id: string, quantity: number) => {
    updateQuantity(id, quantity);
  };

  const handlePriceChange = (id: string, price: number) => {
    const product = products.find(p => p.id === id);
    const minPrice = product?.min_selling_price || 0;

    if (price < minPrice) {
      toast.warning(`Harga tidak boleh di bawah minimum: ${new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR" }).format(minPrice)}`);
      updatePrice(id, minPrice);
    } else {
      updatePrice(id, price);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page on search
    setSelectedCategory(null); // Reset category clear search context
  };

  const handleCategoryChange = (category: string | null) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  // Effect to update prices when customer changes
  useEffect(() => {
    const updateCartPrices = async () => {
      // Avoid running on initial mount if cart is empty, but crucial when customer changes
      if (cartItems.length === 0) return;

      const updates = cartItems.map(async (item) => {
        let newPrice = item.price;
        let foundHistory = false;

        // 1. Try to find base price from loaded products
        // If product not in current page, this might verify fail. 
        // Ideal: Store 'basePrice' in CartItem. 
        // Fallback: If product found in 'products' state, use that.
        const product = products.find(p => p.id === item.id);
        const basePrice = product ? product.price : item.price; // Fallback to current if not found (risk of sticking to old custom price)
        const minPrice = product?.min_selling_price || 0;

        // Optimistic default: revert to base (if we found it)
        if (product) newPrice = basePrice;

        if (selectedCustomer) {
          try {
            const res = await fetch(`/api/customers/${selectedCustomer.id}/last-price?productId=${item.id}`);
            if (res.ok) {
              const data = await res.json();
              if (data.price !== null && data.price !== undefined) {
                newPrice = data.price;
                foundHistory = true;
              }
            }
          } catch (err) {
            console.error("Failed to fetch last price for update", err);
          }
        }

        let hitMinPrice = false;

        // Enforce Minimum Selling Price
        if (newPrice < minPrice) {
          newPrice = minPrice;
          hitMinPrice = true;
        }

        // Only update if price is different
        if (newPrice !== item.price) {
          updatePrice(item.id, newPrice);
          return { name: item.name, newPrice, foundHistory, hitMinPrice };
        }
        return null;
      });

      const results = await Promise.all(updates);
      const changed = results.filter(r => r !== null);

      if (changed.length > 0) {
        const historyCount = changed.filter(c => c?.foundHistory).length;
        const minPriceCount = changed.filter(c => c?.hitMinPrice).length;

        if (minPriceCount > 0) {
          toast.warning(`Beberapa harga disesuaikan ke harga jual minimum.`);
        } else if (historyCount > 0) {
          toast.success(`Harga diperbarui mengikuti riwayat pelanggan.`);
        } else {
          toast.info(`Harga dikembalikan ke standar.`);
        }
      }
    };

    updateCartPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomer]); // Dependency strictly on selectedCustomer to avoid loops/overwrites on manual edits


  const toggleScanner = () => {
    setIsScannerOpen(!isScannerOpen);
  };

  const handleScan = (code: string) => {
    // Find product by barcode locally first (optimization)
    const product = products.find(p => p.barcode === code);
    if (product) {
      handleAddToCart(product);
      setIsScannerOpen(false); // Close scanner on successful scan ? Maybe keep open for multiple.
      toast.success(`Ditemukan: ${product.name}`);
    } else {
      // If not in current page, might need to fetch by barcode API specifically
      // For now, just try to search via query
      setSearchQuery(code);
      setIsScannerOpen(false);
      toast.info(`Mencari barcode: ${code}`);
    }
  };

  const handleCheckout = useCallback(() => {
    if (cartItems.length === 0) {
      toast.error("Keranjang kosong");
      return;
    }
    setIsCheckoutOpen(true);
    setIsCartOpen(false); // Close mobile cart if open
  }, [cartItems.length]);

  const refreshProducts = () => {
    fetchProducts();
    setSelectedCustomer(null); // Reset customer after checkout
  };

  // Maps cart items to component expected format
  const cartItemsForComponent = cartItems.map(item => ({
    id: item.id,
    productId: item.id,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    unit: item.unit,
    maxQuantity: item.stock
  }));

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-7 xl:grid-cols-7 gap-4 lg:gap-5 h-[calc(100vh-150px)]">
        {/* Products Grid - Full Width on Mobile */}
        <div className="lg:col-span-4 xl:col-span-5 space-y-4 overflow-auto pb-20 sm:pb-0 h-full no-scrollbar">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur pb-2 space-y-4 pt-1">
            <div className="mx-auto w-full">
              <ProductSearch
                products={products}
                onProductSelect={handleAddToCart}
                onScanClick={toggleScanner}
                isLoading={isLoading}
                onSearch={handleSearch}
              />
            </div>

            {/* Mobile Customer Selector */}
            <div className="lg:hidden mx-auto w-full">
              <CustomerSelector
                selectedCustomer={selectedCustomer}
                onSelectCustomer={setSelectedCustomer}
              />
            </div>

            {/* Category Filter */}
            <CategoryFilter
              products={products} // Note: CategoryFilter typically might fetching categories itself or derive from products
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
                <div className="flex justify-center my-6 pb-8">
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
        <div className="lg:col-span-3 xl:col-span-2 hidden lg:flex flex-col h-full gap-4 border-l pl-4">
          <div className="flex-none">
            <CustomerSelector
              selectedCustomer={selectedCustomer}
              onSelectCustomer={setSelectedCustomer}
            />
          </div>
          <div className="flex-1 overflow-hidden">
            <Cart
              items={cartItemsForComponent}
              onQuantityChange={handleQuantityChange}
              onPriceChange={handlePriceChange}
              isPriceEditable={!!selectedCustomer}
              onRemove={handleRemoveItem}
              onCheckout={handleCheckout}
              onClear={clearCart}
            />
          </div>
        </div>
      </div>

      {/* Mobile Cart Button - Fixed at Bottom */}
      <div className="lg:hidden fixed bottom-4 left-0 right-0 px-4 z-40">
        <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
          <SheetTrigger asChild>
            <Button
              className={cn(
                "w-full py-6 flex items-center justify-between shadow-lg relative",
                totalCartItems > 0 ? "bg-primary text-primary-foreground" : "bg-muted"
              )}
            >
              <div className="flex items-center">
                <div className="relative mr-2">
                  <ShoppingCart className="h-5 w-5" />
                  {totalCartItems > 0 && (
                    <span className="absolute -top-2 -right-2 bg-white text-primary text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                      {totalCartItems > 99 ? '99+' : totalCartItems}
                    </span>
                  )}
                </div>
                <span className="font-medium">{totalCartItems > 0 ? "Keranjang" : "Keranjang Kosong"}</span>
              </div>
              {totalCartItems > 0 && (
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
          <SheetContent side="bottom" className="h-[90vh] px-4 py-4 flex flex-col gap-4">

            <Cart
              items={cartItemsForComponent}
              onQuantityChange={handleQuantityChange}
              onPriceChange={handlePriceChange}
              isPriceEditable={!!selectedCustomer}
              onRemove={handleRemoveItem}
              onCheckout={handleCheckout}
              onClear={clearCart}
              className="flex-1 border-0 rounded-none shadow-none"
              onCloseCart={() => setIsCartOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Scanner Dialog */}
      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="sm:max-w-md">
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
        customer={selectedCustomer}
      />
    </div>
  );
} 