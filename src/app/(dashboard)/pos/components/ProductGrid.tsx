import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/currency';
import { Plus } from 'lucide-react';

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

  return (
    <div className="space-y-6">
      {Object.entries(productsByCategory).map(([category, products]) => (
        <div key={category} className="space-y-3">
          <h3 className="font-semibold text-lg">{category}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map(product => (
              <Card key={product.id} className="overflow-hidden hover:border-primary/50 transition-colors">
                <CardContent className="p-0">
                  <button 
                    onClick={() => onProductSelect(product)}
                    className="w-full h-full p-4 text-left"
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h4 className="font-medium truncate max-w-[180px]">{product.name}</h4>
                        <div className="flex items-center space-x-2">
                          <Badge variant={product.stock > 10 ? "secondary" : product.stock > 0 ? "outline" : "destructive"}>
                            Stok: {product.stock} {product.unit}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="font-semibold">{formatCurrency(product.price)}</div>
                        <Button size="icon" variant="ghost" className="h-8 w-8 mt-1 rounded-full" aria-label="Tambah ke keranjang">
                          <Plus className="h-4 w-4" />
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