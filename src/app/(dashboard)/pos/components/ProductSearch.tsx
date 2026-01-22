"use client";

import { BarcodeInput } from './BarcodeInput';
import { Loader2 } from 'lucide-react';

// Mendefinisikan tipe Product karena tidak bisa diimpor dari Prisma Client
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
  const handleSearch = (query: string) => {
    // Direct barcode match if exact match
    if (query) {
      const barcodeMatch = products.find(p =>
        p.barcode && p.barcode.toLowerCase() === query.toLowerCase()
      );

      if (barcodeMatch) {
        onProductSelect(barcodeMatch);
        return;
      }
    }

    // Delegate to server search when parent provides onSearch callback
    if (onSearch) {
      onSearch(query);
    }
  };

  return (
    <div className="w-full">
      <BarcodeInput
        onSubmit={handleSearch}
        onScanClick={onScanClick}
      />

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}