"use client";

import { BarcodeInput } from './BarcodeInput';
import { Product } from '@/types/index';

// Mendefinisikan tipe Product karena tidak bisa diimpor dari Prisma Client

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
    </div>
  );
}