"use client";

import { useEffect, useState } from 'react';
import Fuse from 'fuse.js';
import { BarcodeInput } from './BarcodeInput';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Plus, Search } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';

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

    // Notify parent component about search
    if (onSearch) {
      // Use a small delay to prevent excessive API calls during typing
      const timeoutId = setTimeout(() => {
        onSearch(query);
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }

    // Direct barcode match
    const barcodeMatch = products.find(p => 
      p.barcode && p.barcode.toLowerCase() === query.toLowerCase()
    );
    
    if (barcodeMatch) {
      onProductSelect(barcodeMatch);
      setSearchQuery('');
      return;
    }

    // Fuzzy search
    if (fuse && query) {
      const searchResults = fuse.search(query).map(result => result.item);
      setResults(searchResults);
    } else {
      setResults([]);
    }
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
        <Card className="mt-2 shadow-sm">
          <CardContent className="p-0">
            <ul className="divide-y max-h-[28rem] overflow-auto">
              {results.map((product) => (
                <li key={product.id} className="hover:bg-accent transition-colors">
                  <button
                    onClick={() => {
                      onProductSelect(product);
                      setSearchQuery('');
                      setResults([]);
                    }}
                    className="w-full py-3 px-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="bg-muted rounded-md h-10 w-10 flex items-center justify-center">
                        {product.barcode ? (
                          <span className="text-xs text-center text-muted-foreground">
                            {product.barcode.substring(0, 8)}...
                          </span>
                        ) : (
                          <Search className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium truncate max-w-[16rem]">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.category || "Tanpa Kategori"} • Stok: {product.stock} {product.unit}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(Number(product.price))}</p>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : searchQuery ? (
        <Card className="mt-2 shadow-sm">
          <CardContent className="py-6 text-center text-muted-foreground">
            Tidak ada produk yang sesuai dengan &quot;{searchQuery}&quot;
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
} 