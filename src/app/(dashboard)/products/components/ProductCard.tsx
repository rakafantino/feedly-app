import React from 'react';
import { formatRupiah, getStockVariant } from "@/lib/utils";
import { Product } from "@/types/product";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Pencil, Trash2, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProductCardProps {
  product: Product;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onConvert?: (product: Product) => void;
}

export function ProductCard({ product, onEdit, onDelete, onConvert }: ProductCardProps) {
  return (
    <Card className="h-full">
      <CardContent className="pt-6">
        <div className="mb-2 flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold line-clamp-1 text-base">{product.name}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{product.description || 'Tidak ada deskripsi'}</p>
          </div>
          <div className="ml-2 flex-shrink-0">
            <Badge variant={getStockVariant(product.stock, product.threshold)}>
              Stok: {product.stock}
            </Badge>
          </div>
        </div>
        
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center text-sm text-muted-foreground">
            <Package className="mr-1 h-4 w-4" />
            <span>{product.category || 'Tidak ada kategori'}</span>
          </div>
          <p className="font-semibold text-base">{formatRupiah(product.price)}</p>
        </div>
      </CardContent>
      
      <CardFooter className="border-t p-3 flex items-center justify-between gap-2">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onEdit(product.id)}
          className="flex-1 flex items-center justify-center gap-1"
        >
          <Pencil className="h-3.5 w-3.5" />
          <span>Edit</span>
        </Button>

        {product.conversionTargetId && onConvert && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onConvert(product)}
            className="flex-1 flex items-center justify-center gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <Package className="h-3.5 w-3.5" />
            <span>Buka</span>
          </Button>
        )}

        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onDelete(product.id)}
          className="flex-1 flex items-center justify-center gap-1 text-destructive border-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Hapus</span>
        </Button>
      </CardFooter>
    </Card>
  );
} 