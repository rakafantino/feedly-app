"use client";

import { useState } from "react";
import { ProductSearch } from "./components/ProductSearch";
import { Cart } from "./components/Cart";
import { useCart } from "@/lib/store";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { BarcodeScanner } from "./components/BarcodeScanner";
import CheckoutModal from "./components/CheckoutModal";
import ProductGrid from "./components/ProductGrid";
import { CategoryFilter } from "./components/CategoryFilter";
import { Pagination } from "@/components/ui/pagination";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CustomerSelector } from "./components/CustomerSelector";
import { usePOSProducts, useAddToCart } from "@/hooks/usePOS";

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

export default function POSPage() {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCartOpen, setIsCartOpen] = useState(false); // Mobile cart sheet

  const { items: cartItems, removeItem, updateQuantity, updatePrice, clearCart } = useCart();

  // React Query hooks - replaces manual fetch
  const { data, isLoading } = usePOSProducts({
    currentPage,
    searchQuery,
    selectedCategory,
  });

  const addToCartMutation = useAddToCart();
  // checkoutMutation is used by CheckoutModal, not directly in page
  // const checkoutMutation = useCheckout();

  const products = data?.products || [];
  const totalPages = data?.pagination?.totalPages || 1;

  // Calculate subtotal for mobile button
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalCartItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const toggleScanner = () => setIsScannerOpen(!isScannerOpen);

  // Handlers
  const handleAddToCart = (product: Product) => {
    addToCartMutation.mutate({ product, customer: selectedCustomer });
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

  const handleCheckout = () => {
    setIsCheckoutOpen(true);
  };

  const handleCheckoutSuccess = () => {
    setIsCheckoutOpen(false);
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
            <Button className="w-full shadow-lg" size="lg">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Lihat Keranjang ({totalCartItems} item)
              <span className="ml-auto font-bold">
                {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(subtotal)}
              </span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[70vh]" showCloseButton={false}>
            <Cart
              items={cartItemsForComponent}
              onQuantityChange={handleQuantityChange}
              onPriceChange={handlePriceChange}
              onRemove={handleRemoveItem}
              isPriceEditable={!!selectedCustomer}
              onCheckout={() => {
                setIsCartOpen(false);
                handleCheckout();
              }}
              onClear={clearCart}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Barcode Scanner Dialog */}
      <Dialog open={isScannerOpen} onOpenChange={setIsScannerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Scan Barcode</DialogTitle>
          <BarcodeScanner
            isOpen={isScannerOpen}
            onScan={(barcode) => {
              // Find product by barcode and add to cart
              const product = products.find(p => p.barcode === barcode);
              if (product) {
                handleAddToCart(product);
                setIsScannerOpen(false);
              } else {
                toast.error("Produk tidak ditemukan");
              }
            }}
            onClose={() => setIsScannerOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onSuccess={handleCheckoutSuccess}
        customer={selectedCustomer}
      />
    </div>
  );
}
