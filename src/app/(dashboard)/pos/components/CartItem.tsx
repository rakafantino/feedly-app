"use client";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface CartItemType {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  maxQuantity?: number; // Batas stok
}

interface CartItemProps {
  item: CartItemType;
  onQuantityChange: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}

export function CartItem({ item, onQuantityChange, onRemove }: CartItemProps) {
  const [quantity, setQuantity] = useState(item.quantity);
  
  // Sinkronisasi local state dengan prop ketika item.quantity berubah
  useEffect(() => {
    setQuantity(item.quantity);
  }, [item.quantity]);

  const increaseQuantity = () => {
    if (item.maxQuantity && quantity >= item.maxQuantity) return;
    const newQuantity = quantity + 1;
    setQuantity(newQuantity);
    onQuantityChange(item.id, newQuantity);
  };

  const decreaseQuantity = () => {
    if (quantity <= 1) return;
    const newQuantity = quantity - 1;
    setQuantity(newQuantity);
    onQuantityChange(item.id, newQuantity);
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (isNaN(value)) return;
    
    let newQuantity = value;
    if (item.maxQuantity) {
      newQuantity = Math.min(value, item.maxQuantity);
    }
    newQuantity = Math.max(1, newQuantity);

    setQuantity(newQuantity);
    onQuantityChange(item.id, newQuantity);
  };

  // Cek apakah item mencapai batas stok
  const isAtMaxQuantity = item.maxQuantity !== undefined && quantity >= item.maxQuantity;
  
  return (
    <div className="group pt-3 pb-2 hover:bg-accent/30 rounded-md transition-colors">
      <div className="flex items-start justify-between px-1">
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-start">
            <p className="font-medium truncate mr-2">{item.name}</p>
            {isAtMaxQuantity && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-orange-200 text-orange-600 bg-orange-50">
                Maks
              </Badge>
            )}
          </div>
          <div className="flex items-center text-xs text-muted-foreground mt-0.5">
            <span>{formatCurrency(item.price)}</span>
            <span className="mx-1">/</span>
            <span>{item.unit}</span>
          </div>
        </div>

        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity -mt-1 -mr-1" 
          onClick={() => onRemove(item.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sr-only">Hapus</span>
        </Button>
      </div>

      <div className="flex items-center justify-between mt-1.5 px-1">
        <div className="flex items-center space-x-1 border rounded-md bg-background">
          <Button 
            variant="ghost" 
            size="icon" 
            className={cn(
              "h-7 w-7 rounded-none border-r",
              quantity <= 1 && "opacity-50 cursor-not-allowed"
            )}
            onClick={decreaseQuantity}
            disabled={quantity <= 1}
          >
            <Minus className="h-3 w-3" />
            <span className="sr-only">Kurangi</span>
          </Button>

          <input
            type="text"
            className="w-10 h-7 text-center text-xs bg-transparent focus:outline-none focus:ring-0 border-0"
            value={quantity}
            onChange={handleQuantityChange}
            min="1"
            max={item.maxQuantity}
          />

          <Button 
            variant="ghost" 
            size="icon" 
            className={cn(
              "h-7 w-7 rounded-none border-l",
              isAtMaxQuantity && "opacity-50 cursor-not-allowed"
            )}
            onClick={increaseQuantity}
            disabled={isAtMaxQuantity}
          >
            <Plus className="h-3 w-3" />
            <span className="sr-only">Tambah</span>
          </Button>
        </div>

        <div className="font-medium text-right">
          {formatCurrency(item.price * quantity)}
        </div>
      </div>
    </div>
  );
} 