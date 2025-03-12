import React, { useMemo } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Filter, Package } from 'lucide-react';

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
  
  return (
    <div className="w-full py-2">
      <div className="flex items-center mb-2 px-1">
        <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
        <span className="text-sm font-medium">Filter Kategori</span>
      </div>
      <ScrollArea className="w-full whitespace-nowrap pb-1">
        <div className="flex space-x-2 p-1">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => onCategoryChange(null)}
            className={cn(
              "rounded-full text-xs h-8",
              selectedCategory === null ? "bg-primary text-primary-foreground" : ""
            )}
          >
            <Package className="h-3.5 w-3.5 mr-1.5" />
            <span>Semua</span>
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-primary-foreground/10 text-[10px]">
              {totalProducts}
            </span>
          </Button>
          
          {categories.map(category => (
            <Button
              key={category.name}
              variant={selectedCategory === category.name ? "default" : "outline"}
              size="sm"
              onClick={() => onCategoryChange(category.name)}
              className={cn(
                "rounded-full text-xs h-8",
                selectedCategory === category.name ? "bg-primary text-primary-foreground" : ""
              )}
            >
              <span>{category.name}</span>
              <span className={cn(
                "ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]",
                selectedCategory === category.name 
                  ? "bg-primary-foreground/10" 
                  : "bg-primary/10"
              )}>
                {category.count}
              </span>
            </Button>
          ))}
          
          {uncategorizedCount > 0 && (
            <Button
              variant={selectedCategory === "" ? "default" : "outline"}
              size="sm"
              onClick={() => onCategoryChange("")}
              className={cn(
                "rounded-full text-xs h-8",
                selectedCategory === "" ? "bg-primary text-primary-foreground" : ""
              )}
            >
              <span>Lainnya</span>
              <span className={cn(
                "ml-1.5 px-1.5 py-0.5 rounded-full text-[10px]",
                selectedCategory === "" 
                  ? "bg-primary-foreground/10" 
                  : "bg-primary/10"
              )}>
                {uncategorizedCount}
              </span>
            </Button>
          )}
        </div>
        <ScrollBar orientation="horizontal" className="h-1.5" />
      </ScrollArea>
    </div>
  );
} 