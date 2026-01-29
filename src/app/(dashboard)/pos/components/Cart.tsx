"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/currency";
import { ReceiptText, ShoppingCart, Trash, X } from "lucide-react";
import { CartItem, CartItemType } from "./CartItem";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface CartProps {
  items: CartItemType[];
  onQuantityChange: (id: string, quantity: number) => void;
  onPriceChange: (id: string, price: number) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
  onClear: () => void;
  className?: string;
  onCloseCart?: () => void;
  isPriceEditable?: boolean;
}

export function Cart({
  items,
  onQuantityChange,
  onPriceChange,
  onRemove,
  onCheckout,
  onClear,
  className,
  onCloseCart,
  isPriceEditable = true,
}: CartProps) {
  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = items.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  return (
    <Card className={cn("flex flex-col sm:h-[calc(100vh-10rem)] h-full sticky top-0", className)}>
      <CardHeader className="py-3 px-4 border-b flex-shrink-0">
        <CardTitle className="flex justify-between items-center text-base">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            <span>Keranjang Belanja</span>
            {totalItems > 0 && (
              <Badge variant="default" className="rounded-full h-6 px-2 text-xs">
                {totalItems} item
              </Badge>
            )}
          </div>

          {onCloseCart && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCloseCart}
              className="h-8 w-8 -mr-2 lg:hidden"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Tutup</span>
            </Button>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-3 md:p-4 min-h-[200px]">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4">
            <ShoppingCart className="h-12 w-12 mb-3 opacity-20" />
            <p className="font-medium text-center">Keranjang belanja kosong</p>
            <p className="text-sm text-center mt-1">Tambahkan produk untuk memulai transaksi</p>
          </div>
        ) : (
          <div className="space-y-2 divide-y">
            {items.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                onQuantityChange={onQuantityChange}
                onPriceChange={onPriceChange}
                onRemove={onRemove}
                isPriceEditable={isPriceEditable}
              />
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex-col pt-4 pb-4 px-4 border-t flex-shrink-0 bg-card shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10">
        <div className="w-full space-y-2 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>

          <Separator className="my-2" />

          <div className="flex justify-between items-center font-bold text-lg">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(subtotal)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            className="flex gap-1.5 h-10"
            onClick={onClear}
            disabled={items.length === 0}
          >
            <Trash className="h-4 w-4" />
            <span>Bersihkan</span>
          </Button>

          <Button
            className="flex gap-1.5 h-10"
            onClick={onCheckout}
            disabled={items.length === 0}
          >
            <ReceiptText className="h-4 w-4" />
            <span>Bayar</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
} 