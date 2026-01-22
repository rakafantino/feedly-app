"use client";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import { Minus, Plus, Trash2, Edit2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export interface CartItemType {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number; // Can be decimal for weight-based products (e.g., 0.5 kg)
  unit: string;
  maxQuantity?: number; // Batas stok
}

interface CartItemProps {
  item: CartItemType;
  onQuantityChange: (id: string, quantity: number) => void;
  onPriceChange: (id: string, price: number) => void;
  onRemove: (id: string) => void;
  isPriceEditable?: boolean;
}

export function CartItem({ item, onQuantityChange, onPriceChange, onRemove, isPriceEditable = true }: CartItemProps) {
  const [localQuantity, setLocalQuantity] = useState(item.quantity);
  const [inputValue, setInputValue] = useState(item.quantity.toString());
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Price Editing State
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [priceInputValue, setPriceInputValue] = useState(item.price.toString());
  const priceInputRef = useRef<HTMLInputElement>(null);

  // Sinkronisasi local state dengan prop ketika item.quantity berubah
  useEffect(() => {
    if (!isEditing) {
      setLocalQuantity(item.quantity);
      setInputValue(item.quantity.toString());
    }
  }, [item.quantity, isEditing]);

  // Sync price input if item.price changes externally
  useEffect(() => {
    if (!isEditingPrice) {
      setPriceInputValue(item.price.toString());
    }
  }, [item.price, isEditingPrice]);

  const commitQuantity = (value: number) => {
    let finalQuantity = value;
    if (finalQuantity < 1 || isNaN(finalQuantity)) finalQuantity = 1;
    if (item.maxQuantity && finalQuantity > item.maxQuantity) finalQuantity = item.maxQuantity;
    setLocalQuantity(finalQuantity);
    setInputValue(finalQuantity.toString());
    onQuantityChange(item.id, finalQuantity);
  };

  const commitPrice = (value: number) => {
    let finalPrice = value;
    if (finalPrice < 0 || isNaN(finalPrice)) finalPrice = 0;
    setPriceInputValue(finalPrice.toString());
    onPriceChange(item.id, finalPrice);
  };

  const increaseQuantity = () => {
    if (item.maxQuantity && localQuantity >= item.maxQuantity) return;
    commitQuantity(localQuantity + 1);
  };

  const decreaseQuantity = () => {
    if (localQuantity <= 1) return;
    commitQuantity(localQuantity - 1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) setInputValue(value);
  };

  const handlePriceInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) setPriceInputValue(value);
  };

  const handleInputFocus = () => {
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };



  const handleInputBlur = () => {
    setIsEditing(false);
    const parsed = parseFloat(inputValue);
    commitQuantity(isNaN(parsed) ? 1 : parsed);
  };

  const handlePriceInputBlur = () => {
    setIsEditingPrice(false);
    const parsed = parseFloat(priceInputValue);
    commitPrice(isNaN(parsed) ? 0 : parsed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') inputRef.current?.blur();
    if (e.key === 'Escape') {
      setInputValue(localQuantity.toString());
      inputRef.current?.blur();
    }
  };

  const handlePriceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') priceInputRef.current?.blur();
    if (e.key === 'Escape') {
      setPriceInputValue(item.price.toString());
      priceInputRef.current?.blur();
    }
  };

  // Cek apakah item mencapai batas stok
  const isAtMaxQuantity = item.maxQuantity !== undefined && localQuantity >= item.maxQuantity;

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
          <div className="flex items-center text-xs text-muted-foreground mt-0.5" onClick={() => { if (isPriceEditable && !isEditingPrice) { setIsEditingPrice(true); setTimeout(() => priceInputRef.current?.focus(), 10); } }}>
            {isEditingPrice ? (
              <Input
                ref={priceInputRef}
                type="text"
                inputMode="numeric"
                value={priceInputValue}
                onChange={handlePriceInputChange}
                onBlur={handlePriceInputBlur}
                onKeyDown={handlePriceKeyDown}
                className="h-5 w-20 px-1 py-0 text-xs border rounded-sm"
                autoFocus
              />
            ) : (
              <div className={cn(
                "flex items-center transition-colors border-b border-dashed border-transparent",
                isPriceEditable ? "cursor-pointer hover:text-primary hover:border-primary/50" : "cursor-default"
              )} title={isPriceEditable ? "Klik untuk ubah harga" : "Harga terkunci"}>
                <span>{formatCurrency(item.price)}</span>
                {isPriceEditable && <Edit2 className="h-3 w-3 ml-1 opacity-0 group-hover:opacity-50" />}
              </div>
            )}
            <span className="mx-1">/</span>
            <span>{item.unit}</span>
          </div>
        </div>

        {/* Delete Button */}
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
              localQuantity <= 1 && "opacity-50 cursor-not-allowed"
            )}
            onClick={decreaseQuantity}
            disabled={localQuantity <= 1}
          >
            <Minus className="h-3 w-3" />
            <span className="sr-only">Kurangi</span>
          </Button>

          <Input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            className="w-12 h-7 text-center text-xs bg-transparent focus:outline-none focus:ring-0 border-0 p-0"
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
          {formatCurrency(item.price * localQuantity)}
        </div>
      </div>
    </div>
  );
} 