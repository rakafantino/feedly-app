"use client";

import { useEffect, useState } from 'react';
import Fuse from 'fuse.js';
import { BarcodeInput } from './BarcodeInput';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Plus, Search, Tag, Package, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Mendefinisikan tipe Product karena tidak bisa diimpor dari Prisma Client
interface Product {
  id: string;
  name: string;
  barcode?: string | null;
  category?: string | null;
  price: number;
  stock: number;
  unit: string;
}

interface ProductSearchProps {
  products: Product[];
  onProductSelect: (product: Product) => void;
  onScanClick?: () => void;
  isLoading?: boolean;
  onSearch?: (query: string) => void;
}

export function ProductSearch({
  products,
  onProductSelect,
  onScanClick,
  isLoading = false,
  onSearch
}: ProductSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [fuse, setFuse] = useState<Fuse<Product> | null>(null);

  // Initialize Fuse.js
  useEffect(() => {
    const fuseOptions = {
      keys: ['name', 'barcode', 'category'],
      threshold: 0.4,
      includeScore: true,
    };
    setFuse(new Fuse(products, fuseOptions));
  }, [products]);

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);

    // Direct barcode match if exact match
    if (query) {
      const barcodeMatch = products.find(p => 
        p.barcode && p.barcode.toLowerCase() === query.toLowerCase()
      );
      
      if (barcodeMatch) {
        onProductSelect(barcodeMatch);
        setSearchQuery('');
        return;
      }
    }

    // Delegate to server search when parent provides onSearch callback
    if (onSearch) {
      onSearch(query);
    }

    // Always do local search for instant feedback
    if (fuse && query) {
      const searchResults = fuse.search(query).map(result => result.item);
      setResults(searchResults);
    } else {
      setResults([]);
    }
  };

  const getStockVariant = (stock: number) => {
    if (stock <= 0) return "destructive";
    if (stock <= 5) return "warning";
    return "success";
  };

  return (
    <div className="w-full">
      <BarcodeInput 
        onSubmit={handleSearch}
        onScanClick={onScanClick}
      />

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : searchQuery && results.length > 0 ? (
        <Card className="mt-2 shadow-md border-border">
          <CardContent className="p-0">
            <div className="max-h-[28rem] overflow-auto">
              {results.map((product) => (
                <div 
                  key={product.id} 
                  className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors"
                >
                  <button
                    onClick={() => {
                      onProductSelect(product);
                      setSearchQuery('');
                      setResults([]);
                    }}
                    className={cn(
                      "w-full p-4 flex flex-col text-left",
                      product.stock <= 0 && "opacity-70 cursor-not-allowed"
                    )}
                    disabled={product.stock <= 0}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className={cn(
                        "font-semibold text-base",
                        product.stock <= 0 && "text-muted-foreground"
                      )}>
                        {product.name}
                      </h3>
                      <Badge variant={getStockVariant(product.stock)} className="ml-2">
                        {product.stock} {product.unit}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-muted-foreground space-x-3">
                        {product.barcode && (
                          <div className="flex items-center gap-1">
                            <Tag className="h-3.5 w-3.5" />
                            <span>{product.barcode}</span>
                          </div>
                        )}
                        
                        {product.category && (
                          <div className="flex items-center gap-1">
                            <Package className="h-3.5 w-3.5" />
                            <span>{product.category}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-medium text-primary",
                          product.stock <= 0 && "text-muted-foreground"
                        )}>
                          {formatCurrency(Number(product.price))}
                        </span>
                        <div className={cn(
                          "rounded-full p-1",
                          product.stock > 0 
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {product.stock > 0 ? (
                            <Plus className="h-4 w-4" />
                          ) : (
                            <AlertCircle className="h-4 w-4" />
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : searchQuery ? (
        <Card className="mt-2 shadow-sm border border-border">
          <CardContent className="py-8 text-center">
            <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">
              Tidak ada produk yang sesuai dengan <span className="font-medium">&quot;{searchQuery}&quot;</span>
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
} 