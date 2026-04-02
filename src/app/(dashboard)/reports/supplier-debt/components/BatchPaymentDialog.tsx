'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatRupiah } from '@/lib/utils';
import { toast } from 'sonner';

interface BatchPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  supplierName: string;
  totalDebt: number;
  onSuccess: () => void;
}

export function BatchPaymentDialog({
  isOpen,
  onClose,
  supplierId,
  supplierName,
  totalDebt,
  onSuccess
}: BatchPaymentDialogProps) {
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const numericAmount = parseFloat(amount.replace(/[^0-9]/g, ''));
    
    if (!numericAmount || numericAmount <= 0) {
      toast.error('Nominal pembayaran harus lebih dari 0');
      return;
    }

    if (numericAmount > totalDebt) {
      toast.error(`Nominal pembayaran tidak boleh melebihi total hutang (${formatRupiah(totalDebt)})`);
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(`/api/suppliers/${supplierId}/pay-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: numericAmount,
          paymentMethod: paymentMethod,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memproses pembayaran');
      }

      toast.success('Pembayaran berhasil diproses');
      setAmount('');
      setNotes('');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Terjadi kesalahan saat memproses pembayaran');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value) {
      setAmount(formatRupiah(parseFloat(value)));
    } else {
      setAmount('');
    }
  };

  const handleSetMaxAmount = () => {
    setAmount(formatRupiah(totalDebt));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Bayar Hutang Kolektif</DialogTitle>
          <DialogDescription>
            Pembayaran akan dialokasikan ke PO yang paling lama (FIFO).
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Supplier</Label>
            <div className="font-medium">{supplierName}</div>
          </div>
          
          <div className="space-y-2">
            <Label>Total Hutang</Label>
            <div className="font-bold text-red-600">{formatRupiah(totalDebt)}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Nominal Pembayaran</Label>
            <div className="relative">
              <Input
                id="amount"
                value={amount}
                onChange={handleAmountChange}
                placeholder="Rp 0"
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-7 text-xs"
                onClick={handleSetMaxAmount}
                disabled={isLoading}
              >
                Bayar Semua
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Metode Pembayaran</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={isLoading}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih metode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Tunai (Cash)</SelectItem>
                <SelectItem value="TRANSFER">Transfer Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Catatan (Opsional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Transfer via BCA"
              disabled={isLoading}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Batal
            </Button>
            <Button type="submit" disabled={isLoading || !amount}>
              {isLoading ? 'Memproses...' : 'Bayar Sekarang'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
