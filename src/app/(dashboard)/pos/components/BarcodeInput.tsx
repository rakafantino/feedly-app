"use client";

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Scan, X } from 'lucide-react';

interface BarcodeInputProps {
  onSubmit: (value: string) => void;
  onScanClick?: () => void;
}

export function BarcodeInput({ onSubmit, onScanClick }: BarcodeInputProps) {
  const [value, setValue] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    
    // Debounce search updates
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      onSubmit(newValue);
    }, 300);
  };

  // Focus input on mount for better UX
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If Enter is pressed, submit the form immediately
    if (e.key === 'Enter') {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-2">
      <div className="relative flex-1 w-full sm:max-w-[calc(100%-60px)] lg:max-w-[calc(100%-60px)]">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Cari produk atau scan barcode..."
          className="pl-8 w-full"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue('');
              if (inputRef.current) inputRef.current.focus();
              onSubmit('');
            }}
            className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Clear</span>
          </button>
        )}
      </div>
      {onScanClick && (
        <Button 
          type="button" 
          variant="outline" 
          size="icon" 
          onClick={onScanClick} 
          title="Scan Barcode (F1)"
          className="w-full sm:w-[46px] h-[40px] flex justify-center items-center"
        >
          <Scan className="h-4 w-4" />
          <span className="sm:hidden">Scan Barcode</span>
        </Button>
      )}
    </form>
  );
} 