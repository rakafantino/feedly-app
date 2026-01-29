import React, { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter } from 'lucide-react';

interface Product {
  category?: string | null;
}

interface CategoryFilterProps {
  products: Product[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

export function CategoryFilter({ products, selectedCategory, onCategoryChange }: CategoryFilterProps) {
  // Extract unique categories and count products per category
  const categories = useMemo(() => {
    const categoryCounts = new Map<string, number>();
    
    products.forEach(product => {
      if (product.category) {
        const category = product.category;
        categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
      }
    });
    
    return Array.from(categoryCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);
  
  if (categories.length === 0) {
    return null;
  }
  
  // Count products without category
  const uncategorizedCount = products.filter(p => !p.category || p.category.trim() === "").length;
  
  // Total product count
  const totalProducts = products.length;

  // Determine current value for Select
  const currentValue = selectedCategory === null ? "all" : (selectedCategory === "" ? "uncategorized" : selectedCategory);

  const handleValueChange = (value: string) => {
    if (value === "all") onCategoryChange(null);
    else if (value === "uncategorized") onCategoryChange("");
    else onCategoryChange(value);
  };
  
  return (
    <div className="w-auto">
      <Select value={currentValue} onValueChange={handleValueChange}>
        <SelectTrigger className="w-[260px] h-10 focus:ring-0">
              <Filter className="h-3.5 w-3.5 mr-2" />
           <SelectValue placeholder="Pilih Kategori" />
        </SelectTrigger>
        <SelectContent>
            <SelectItem value="all">
              Semua Produk <span className="text-muted-foreground ml-1">({totalProducts})</span>
            </SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.name} value={cat.name}>
                {cat.name} <span className="text-muted-foreground ml-1">({cat.count})</span>
              </SelectItem>
            ))}
            {uncategorizedCount > 0 && (
               <SelectItem value="uncategorized">
                 Lainnya <span className="text-muted-foreground ml-1">({uncategorizedCount})</span>
               </SelectItem>
            )}
        </SelectContent>
      </Select>
    </div>
  );
} 