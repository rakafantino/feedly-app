// SearchInput.tsx
// Reusable search input component

"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onClear?: () => void;
}

/**
 * SearchInput - Reusable search input with clear button
 * 
 * Usage Examples:
 * 
 * // Basic usage
 * <SearchInput 
 *   value={searchTerm}
 *   onChange={setSearchTerm}
 *   placeholder="Cari produk..."
 * />
 * 
 * // With clear callback
 * <SearchInput 
 *   value={searchTerm}
 *   onChange={setSearchTerm}
 *   placeholder="Cari..."
 *   onClear={() => setSearchTerm("")}
 * />
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Cari...",
  className,
  onClear,
}: SearchInputProps) {
  return (
    <div className={`relative ${className || ""}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 pr-8"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
          onClick={() => {
            onChange("");
            onClear?.();
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}
