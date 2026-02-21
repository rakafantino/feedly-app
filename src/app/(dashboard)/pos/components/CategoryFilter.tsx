import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter } from 'lucide-react';
import { Product } from '@/types/index';
import { useCategories } from '@/hooks/useCategories';

interface CategoryFilterProps {
  products: Product[];
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
}

export function CategoryFilter({ selectedCategory, onCategoryChange }: CategoryFilterProps) {
  const { data: globalCategories = [] } = useCategories();

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
              Semua Kategori
            </SelectItem>
            {globalCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.name}>
                {cat.name}
              </SelectItem>
            ))}
            <SelectItem value="uncategorized">
              Lainnya (Tanpa Kategori)
            </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
} 