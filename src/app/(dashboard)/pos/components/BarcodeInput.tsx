"use client";

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Scan } from 'lucide-react';

interface BarcodeInputProps {
  onSubmit: (value: string) => void;
  onScanClick?: () => void;
}

export function BarcodeInput({ onSubmit, onScanClick }: BarcodeInputProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    // Send real-time updates to parent
    onSubmit(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If Enter is pressed, submit the form
    if (e.key === 'Enter') {
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex space-x-2">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Cari produk atau scan barcode..."
          className="pl-8"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
      </div>
      {onScanClick && (
        <Button type="button" variant="outline" size="icon" onClick={onScanClick} title="Scan Barcode (F1)">
          <Scan className="h-4 w-4" />
        </Button>
      )}
    </form>
  );
} 