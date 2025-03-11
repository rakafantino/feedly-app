"use client";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

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
    <div className="flex items-center py-2">
      <div className="flex-1">
        <p className="font-medium">{item.name}</p>
        <p className="text-sm text-muted-foreground">
          {formatCurrency(item.price)} / {item.unit}
        </p>
      </div>

      <div className="flex items-center">
        <div className="flex items-center space-x-1 mr-4">
          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8" 
            onClick={decreaseQuantity}
            disabled={quantity <= 1}
          >
            <Minus className="h-3 w-3" />
            <span className="sr-only">Kurangi</span>
          </Button>

          <input
            type="text"
            className="w-12 h-8 text-center border rounded-md"
            value={quantity}
            onChange={handleQuantityChange}
          />

          <Button 
            variant="outline" 
            size="icon" 
            className="h-8 w-8" 
            onClick={increaseQuantity}
            disabled={item.maxQuantity !== undefined && quantity >= item.maxQuantity}
          >
            <Plus className="h-3 w-3" />
            <span className="sr-only">Tambah</span>
          </Button>
        </div>

        <div className="w-24 text-right mr-2">
          {formatCurrency(item.price * quantity)}
        </div>

        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 text-destructive" 
          onClick={() => onRemove(item.id)}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Hapus</span>
        </Button>
      </div>
    </div>
  );
} 