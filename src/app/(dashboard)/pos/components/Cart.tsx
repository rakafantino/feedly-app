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
import { ShoppingCart } from "lucide-react";
import { CartItem, CartItemType } from "./CartItem";

interface CartProps {
  items: CartItemType[];
  onQuantityChange: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
  onClear: () => void;
}

export function Cart({
  items,
  onQuantityChange,
  onRemove,
  onCheckout,
  onClear,
}: CartProps) {
  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = items.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  return (
    <Card className="h-full flex flex-col sticky top-0">
      <CardHeader className="py-3 px-4 flex-shrink-0">
        <CardTitle className="flex justify-between items-center text-base">
          <span>Keranjang Belanja</span>
          <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
            {totalItems} item
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-3 max-h-[calc(100vh-250px)] min-h-[200px]">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mb-2 opacity-20" />
            <p>Keranjang belanja kosong</p>
            <p className="text-sm">Tambahkan produk untuk memulai transaksi</p>
          </div>
        ) : (
          <div className="space-y-1 divide-y">
            {items.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                onQuantityChange={onQuantityChange}
                onRemove={onRemove}
              />
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex-col pt-4 pb-4 px-4 border-t flex-shrink-0 bg-card">
        <div className="w-full space-y-1 mb-4">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between font-bold text-lg pt-1">
            <span>Total</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
        </div>
        <div className="flex space-x-2 w-full">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClear}
            disabled={items.length === 0}
          >
            Bersihkan
          </Button>
          <Button
            className="flex-1"
            onClick={onCheckout}
            disabled={items.length === 0}
          >
            Bayar
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
} 