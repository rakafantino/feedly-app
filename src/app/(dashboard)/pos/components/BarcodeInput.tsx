"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QrCode } from 'lucide-react';

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
        <Input
          type="text"
          placeholder="Masukkan barcode atau nama produk"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          className="pr-10"
          autoFocus
        />
        {onScanClick && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full"
            onClick={onScanClick}
          >
            <QrCode className="h-4 w-4" />
            <span className="sr-only">Scan Barcode</span>
          </Button>
        )}
      </div>
      <Button type="submit" disabled={!barcode.trim()}>
        Cari
      </Button>
    </form>
  );
} 