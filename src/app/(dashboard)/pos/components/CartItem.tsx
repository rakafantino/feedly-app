"use client";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";

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

  return (
    <div className="group py-3 px-1 hover:bg-accent rounded-md transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-2">
          <p className="font-medium truncate">{item.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(item.price)} / {item.unit}
          </p>
        </div>

        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" 
          onClick={() => onRemove(item.id)}
        >
          <Trash2 className="h-3 w-3" />
          <span className="sr-only">Hapus</span>
        </Button>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center space-x-1">
          <Button 
            variant="outline" 
            size="icon" 
            className="h-6 w-6 rounded-md" 
            onClick={decreaseQuantity}
            disabled={quantity <= 1}
          >
            <Minus className="h-3 w-3" />
            <span className="sr-only">Kurangi</span>
          </Button>

          <input
            type="text"
            className="w-10 h-6 text-center text-xs border rounded-md"
            value={quantity}
            onChange={handleQuantityChange}
            min="1"
            max={item.maxQuantity}
          />

          <Button 
            variant="outline" 
            size="icon" 
            className="h-6 w-6 rounded-md" 
            onClick={increaseQuantity}
            disabled={item.maxQuantity !== undefined && quantity >= item.maxQuantity}
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