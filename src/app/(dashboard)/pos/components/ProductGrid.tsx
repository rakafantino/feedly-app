import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/currency';
import { Package, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

// Mendefinisikan tipe Product
interface Product {
  id: string;
  name: string;
  barcode?: string | null;
  category?: string | null;
  price: number;
  stock: number;
  unit: string;
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
    ? products.filter(product => product.category === selectedCategory)
    : products;

  // Dikelompokkan berdasarkan kategori untuk tampilan yang lebih terorganisir
  const productsByCategory: Record<string, Product[]> = {};
  
  if (selectedCategory) {
    productsByCategory[selectedCategory] = filteredProducts;
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
      <div className="p-8 text-center text-muted-foreground">
        Tidak ada produk {selectedCategory ? `dalam kategori "${selectedCategory}"` : ''}
      </div>
    );
  }

  const getStockVariant = (stock: number) => {
    if (stock <= 0) return "destructive";
    if (stock <= 5) return "outline"; // Stok terbatas
    if (stock <= 20) return "secondary"; // Stok cukup
    return "default"; // Stok banyak
  };

  return (
    <div className="space-y-8">
      {Object.entries(productsByCategory).map(([category, products]) => (
        <div key={category} className="space-y-4">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-lg">{category}</h3>
            <Badge variant="outline" className="ml-2">{products.length} produk</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map(product => (
              <Card 
                key={product.id} 
                className={cn(
                  "overflow-hidden group transition-all duration-200 border-border",
                  product.stock <= 0 
                    ? "opacity-75 border-destructive/20" 
                    : "hover:shadow-md hover:border-primary/30"
                )}
              >
                <CardContent className="p-0">
                  <button 
                    onClick={() => onProductSelect(product)}
                    className="w-full text-left outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    disabled={product.stock <= 0}
                  >
                    <div className="flex flex-col h-[210px]">
                      {/* Card header with category */}
                      <div className="bg-muted/30 py-2 px-3 border-b h-10 flex items-center">
                        <div className="flex justify-between items-center w-full">
                          <Badge variant="secondary" className="capitalize">
                            {product.unit}
                          </Badge>
                          
                          <Badge 
                            variant={getStockVariant(product.stock)} 
                            className="whitespace-nowrap"
                          >
                            Stok: {product.stock}
                          </Badge>
                        </div>
                      </div>
                      
                      {/* Card body with product info */}
                      <div className="p-3 flex-1 flex flex-col justify-center min-h-[100px]">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/10 rounded-md h-12 w-12 flex-shrink-0 flex items-center justify-center text-primary">
                            <Package className="h-6 w-6" />
                          </div>
                          <div className="min-w-0 flex-1"> {/* Untuk menangani overflow */}
                            <h4 className="font-medium text-foreground leading-tight mb-1 text-sm line-clamp-2">
                              {product.name}
                            </h4>
                            {product.barcode && (
                              <p className="text-xs text-muted-foreground truncate">
                                Kode: {product.barcode}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Card footer with price and action */}
                      <div className="py-2 px-3 bg-background border-t flex flex-col h-[70px]">
                        {/* Harga */}
                        <div className="text-center py-1">
                          <span className="font-semibold text-lg text-primary">
                            {formatCurrency(product.price)}
                          </span>
                        </div>
                        
                        {/* Tombol */}
                        <Button 
                          size="sm" 
                          className={cn(
                            "w-full mt-1 transition-colors",
                            product.stock > 0 && "group-hover:bg-primary group-hover:text-primary-foreground"
                          )}
                          variant="outline"
                          disabled={product.stock <= 0}
                        >
                          <ShoppingCart className="h-4 w-4 mr-1" />
                          <span>Tambah ke Keranjang</span>
                        </Button>
                      </div>
                    </div>
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
} 