'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatRupiah } from '@/lib/utils';
import { toast } from 'sonner';
import { RotateCcw, Loader2, CheckCircle2 } from 'lucide-react';

interface DebtItem {
  id: string;
  poNumber: string;
  date: string;
  dueDate: string | null;
  remainingAmount: number;
  paymentStatus: string;
}

interface SupplierReturnDialogProps {
  isOpen: boolean;
  onClose: () => void;
  supplierName: string;
  items: DebtItem[];
}

export function SupplierReturnDialog({
  isOpen,
  onClose,
  supplierName,
  items
}: SupplierReturnDialogProps) {
  const [selectedPO, setSelectedPO] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const poWithDebt = items.filter(item => item.remainingAmount > 0);

  useEffect(() => {
    if (isOpen) {
      setSelectedPO('');
    }
  }, [isOpen]);

  const handleProceed = () => {
    if (!selectedPO) {
      toast.error('Pilih PO yang akan diretur');
      return;
    }

    setIsLoading(true);
    router.push(`/purchase-orders/${selectedPO}?action=return`);
    onClose();
    setIsLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Retur Pembelian
          </DialogTitle>
          <DialogDescription>
            Pilih Purchase Order dari supplier {supplierName} yang akan diretur.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {poWithDebt.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Tidak ada PO dengan sisa hutang untuk diretur.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {poWithDebt.map((po) => (
                <div
                  key={po.id}
                  className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedPO === po.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedPO(po.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedPO === po.id ? 'border-primary bg-primary' : 'border-muted-foreground'
                    }`}>
                      {selectedPO === po.id && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    <div>
                      <Label htmlFor={po.id} className="cursor-pointer font-medium">
                        {po.poNumber}
                      </Label>
                      <div className="text-sm text-muted-foreground">
                        {po.dueDate ? `Jatuh tempo: ${new Date(po.dueDate).toLocaleDateString('id-ID')}` : 'Tanpa jatuh tempo'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-red-600">{formatRupiah(po.remainingAmount)}</div>
                    <div className="text-xs text-muted-foreground">Sisa Hutang</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Batal
          </Button>
          <Button onClick={handleProceed} disabled={isLoading || !selectedPO}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Lanjut ke PO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}