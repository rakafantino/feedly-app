"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QrCode, Search } from 'lucide-react';

interface BarcodeInputProps {
  onSubmit: (barcode: string) => void;
  onScanClick?: () => void;
}

export function BarcodeInput({ onSubmit, onScanClick }: BarcodeInputProps) {
  const [barcode, setBarcode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcode.trim()) {
      onSubmit(barcode.trim());
      setBarcode('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full space-x-2">
      <div className="relative flex-1">
        <div className="absolute left-3 top-0 h-full flex items-center text-muted-foreground">
          <Search className="h-4 w-4" />
        </div>
        <Input
          type="text"
          placeholder="Cari produk berdasarkan nama, kode, atau kategori..."
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          className="pl-9 pr-10"
          autoFocus
        />
        {onScanClick && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
            onClick={onScanClick}
            title="Scan Barcode (F1)"
          >
            <QrCode className="h-4 w-4" />
            <span className="sr-only">Scan Barcode</span>
          </Button>
        )}
      </div>
      <Button 
        type="submit" 
        disabled={!barcode.trim()}
        className="shrink-0"
      >
        Cari
      </Button>
    </form>
  );
} 