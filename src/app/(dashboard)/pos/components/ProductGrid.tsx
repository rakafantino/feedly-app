import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/currency';
import { ShoppingCart, Filter } from 'lucide-react';
import { cn, getStockVariant } from '@/lib/utils';

// Mendefinisikan tipe Product
interface Product {
  id: string;
  name: string;
  barcode?: string | null;
  category?: string | null;
  price: number;
  stock: number;
  unit: string;
  threshold?: number | null;
}

interface ProductGridProps {
  products: Product[];
  onProductSelect: (product: Product) => void;
  selectedCategory: string | null;
}

export default function ProductGrid({
  products,
  onProductSelect,
  selectedCategory
}: ProductGridProps) {
  // Filter produk berdasarkan kategori yang dipilih
  const filteredProducts = selectedCategory
    ? products.filter(product =>
      selectedCategory === ""
        ? !product.category || product.category.trim() === ""
        : product.category === selectedCategory
    )
    : products;

  // Dikelompokkan berdasarkan kategori untuk tampilan yang lebih terorganisir
  const productsByCategory: Record<string, Product[]> = {};

  if (selectedCategory) {
    const categoryName = selectedCategory === "" ? "Tanpa Kategori" : selectedCategory;
    productsByCategory[categoryName] = filteredProducts;
  } else {
    filteredProducts.forEach(product => {
      const category = product.category || 'Tanpa Kategori';
      if (!productsByCategory[category]) {
        productsByCategory[category] = [];
      }
      productsByCategory[category].push(product);
    });
  }

  // Jika tidak ada produk yang sesuai
  if (filteredProducts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="bg-muted/30 rounded-full p-3 mb-4">
          <Filter className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-lg font-medium">Tidak ada produk {selectedCategory ? `dalam kategori "${selectedCategory === "" ? "Tanpa Kategori" : selectedCategory}"` : ''}</p>
        <p className="text-muted-foreground mt-1">Coba pilih kategori lain atau cari produk dengan kata kunci berbeda</p>
      </div>
    );
  }



  return (
    <div className="space-y-8">
      {Object.entries(productsByCategory).map(([category, products]) => (
        <div key={category} className="space-y-4">
          <div className="flex items-center space-x-2 px-1">
            <h3 className="font-semibold text-lg">{category}</h3>
            <Badge variant="outline" className="ml-2">{products.length} produk</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {products.map(product => (
              <Card
                key={product.id}
                className={cn(
                  "overflow-hidden transition-all duration-200 border h-full",
                  product.stock <= 0
                    ? "opacity-80 border-destructive/20 bg-muted/10"
                    : "hover:shadow-md hover:border-primary/20 hover:translate-y-[-2px]"
                )}
              >
                <CardContent className="p-0 h-full flex flex-col">
                  <div
                    onClick={() => product.stock > 0 && onProductSelect(product)}
                    className={cn(
                      "w-full h-full flex flex-col outline-none",
                      product.stock > 0
                        ? "cursor-pointer focus-visible:ring-1 focus-visible:ring-primary"
                        : "cursor-not-allowed"
                    )}
                    role="button"
                    tabIndex={product.stock <= 0 ? -1 : 0}
                    aria-disabled={product.stock <= 0}
                  >
                    {/* Card header with category and stock */}
                    <div className="bg-muted/30 py-2.5 px-4 border-b flex items-center justify-between">
                      <Badge variant="secondary" className="capitalize text-xs font-normal">
                        {product.unit}
                      </Badge>

                      <Badge
                        variant={getStockVariant(product.stock, product.threshold)}
                        className="whitespace-nowrap text-xs"
                      >
                        Stok: {product.stock}
                      </Badge>
                    </div>

                    {/* Card body with product info - Meningkatkan padding */}
                    <div className="p-4 md:p-5 flex-1 flex flex-col">
                      <div className="flex items-start gap-4">

                        <div className="min-w-0 flex-1">
                          <h4 className={cn(
                            "font-medium text-base md:text-lg leading-tight mb-2 line-clamp-2",
                            product.stock <= 0 && "text-muted-foreground"
                          )}>
                            {product.name}
                          </h4>
                          {product.barcode && (
                            <p className="text-xs text-muted-foreground truncate">
                              Kode: {product.barcode}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Price & Action - Vertical Stack for better fit */}
                      <div className="mt-auto pt-4 flex flex-col gap-3">
                        <div className={cn(
                          "font-semibold text-xl",
                          product.stock > 0 ? "text-primary" : "text-muted-foreground"
                        )}>
                          {formatCurrency(product.price)}
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent triggering parent click
                            if (product.stock > 0) onProductSelect(product);
                          }}
                          disabled={product.stock <= 0}
                          className={cn(
                            "w-full flex items-center justify-center text-sm font-medium transition-colors py-2 rounded-md",
                            product.stock > 0
                              ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                              : "bg-muted text-muted-foreground cursor-not-allowed"
                          )}
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          <span>Tambah</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
} 