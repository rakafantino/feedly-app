'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatRupiah } from '@/lib/utils';
import { toast } from 'sonner';

interface PurchaseReturnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: {
    id: string;
    poNumber: string;
    supplierId: string;
    supplierName: string;
    status: string;
    items: Array<{
      id: string;
      productId: string;
      productName: string;
      quantity: number;
      receivedQuantity: number;
      unit: string;
      price: number;
    }>;
  };
  onSuccess: () => void;
}

interface ReturnItem {
  productId: string;
  productName: string;
  returnQuantity: number;
  receivedQuantity: number;
  unit: string;
  unitPrice: number;
}

export function PurchaseReturnDialog({
  open,
  onOpenChange,
  purchaseOrder,
  onSuccess
}: PurchaseReturnDialogProps) {
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && purchaseOrder) {
      const initialItems: ReturnItem[] = purchaseOrder.items
        .filter(item => item.receivedQuantity > 0)
        .map(item => ({
          productId: item.productId,
          productName: item.productName,
          returnQuantity: 0,
          receivedQuantity: item.receivedQuantity,
          unit: item.unit,
          unitPrice: item.price,
        }));
      setReturnItems(initialItems);
      setReason('');
    }
  }, [open, purchaseOrder]);

  const handleReturnQuantityChange = (productId: string, value: number) => {
    setReturnItems(prev =>
      prev.map(item => {
        if (item.productId === productId) {
          const maxQty = item.receivedQuantity;
          const newQty = Math.min(Math.max(0, value), maxQty);
          return { ...item, returnQuantity: newQty };
        }
        return item;
      })
    );
  };

  const totalReturnAmount = useMemo(() => {
    return returnItems.reduce((sum, item) => {
      return sum + item.returnQuantity * item.unitPrice;
    }, 0);
  }, [returnItems]);

  const hasValidReturn = returnItems.some(item => item.returnQuantity > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasValidReturn) {
      toast.error('Pilih minimal satu item untuk diretur');
      return;
    }

    const itemsToReturn = returnItems
      .filter(item => item.returnQuantity > 0)
      .map(item => ({
        productId: item.productId,
        quantity: item.returnQuantity,
        unitPrice: item.unitPrice,
      }));

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/purchase-orders/${purchaseOrder.id}/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: itemsToReturn,
          reason: reason || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal memproses retur pembelian');
      }

      toast.success('Retur pembelian berhasil diproses');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Terjadi kesalahan saat memproses retur');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Retur Pembelian</DialogTitle>
          <DialogDescription>
            Retur untuk PO: {purchaseOrder.poNumber}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-3">
            <div className="font-medium text-sm">Supplier: {purchaseOrder.supplierName}</div>
          </div>

          <div className="border rounded-md">
            <div className="grid grid-cols-12 gap-2 p-3 bg-muted/50 text-xs font-medium">
              <div className="col-span-5">Produk</div>
              <div className="col-span-3 text-right">Diterima</div>
              <div className="col-span-4 text-center">Jumlah Retur</div>
            </div>

            <div className="divide-y">
              {returnItems.map((item) => (
                <div key={item.productId} className="grid grid-cols-12 gap-2 p-3 items-center">
                  <div className="col-span-5">
                    <div className="font-medium text-sm">{item.productName}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatRupiah(item.unitPrice)}/{item.unit}
                    </div>
                  </div>
                  <div className="col-span-3 text-right text-sm">
                    {item.receivedQuantity} {item.unit}
                  </div>
                  <div className="col-span-4">
                    <Input
                      type="number"
                      min="0"
                      max={item.receivedQuantity}
                      value={item.returnQuantity || ''}
                      onChange={(e) => handleReturnQuantityChange(item.productId, parseInt(e.target.value) || 0)}
                      disabled={isSubmitting}
                      className="h-8 text-center"
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}

              {returnItems.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Tidak ada item yang dapat diretur
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
            <span className="font-medium">Total Retur:</span>
            <span className="font-bold text-lg text-red-600">
              {formatRupiah(totalReturnAmount)}
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Alasan Retur (Opsional)</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Barang rusak, tidak sesuai pesanan"
              disabled={isSubmitting}
            />
          </div>

          <DialogFooter className="pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                Batal
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={isSubmitting || !hasValidReturn}
              variant="destructive"
            >
              {isSubmitting ? 'Memproses...' : 'Proses Retur'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
