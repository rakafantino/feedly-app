"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatRupiah, formatDate } from "@/lib/utils";
import { History, ChevronRight } from "lucide-react";

interface BatchPayment {
  id: string;
  totalAmount: number;
  paymentMethod: string;
  notes: string | null;
  createdAt: string;
  paymentCount: number;
  payments: {
    id: string;
    amount: number;
    paidAt: string;
    poId: string | null;
    poNumber: string;
  }[];
}

interface BatchPaymentHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  supplierName: string;
}

export function BatchPaymentHistoryDialog({ isOpen, onClose, supplierId, supplierName }: BatchPaymentHistoryDialogProps) {
  const [batchPayments, setBatchPayments] = useState<BatchPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchBatchPayments();
    }
  }, [isOpen, supplierId]);

  const fetchBatchPayments = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/suppliers/${supplierId}/batch-payments`);
      if (!res.ok) throw new Error("Gagal mengambil riwayat");
      const data = await res.json();
      setBatchPayments(data);
    } catch (error) {
      console.error("Error fetching batch payments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Riwayat Batch Payment
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Semua pembayaran batch untuk supplier: <span className="font-medium text-foreground">{supplierName}</span>
          </p>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Memuat...</div>
          ) : batchPayments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Belum ada riwayat pembayaran batch.</div>
          ) : (
            <div className="space-y-3">
              {batchPayments.map((batch) => (
                <div key={batch.id} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleExpand(batch.id)}>
                    <div className="flex items-center gap-3">
                      <ChevronRight className={`w-4 h-4 transition-transform ${expandedId === batch.id ? "rotate-90" : ""}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatRupiah(batch.totalAmount)}</span>
                          <Badge variant="outline" className="text-xs">
                            {batch.paymentMethod}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(batch.createdAt)} • {batch.paymentCount} PO
                        </div>
                        {batch.notes && <div className="text-xs text-muted-foreground mt-1">{batch.notes}</div>}
                      </div>
                    </div>
                  </div>

                  {expandedId === batch.id && (
                    <div className="border-t bg-muted/30 p-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Rincian Alokasi:</p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">No. PO</TableHead>
                            <TableHead className="text-right text-xs">Jumlah</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batch.payments.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell className="text-sm font-medium">{payment.poNumber}</TableCell>
                              <TableCell className="text-right text-sm text-green-600">{formatRupiah(payment.amount)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="border-t-2">
                            <TableCell className="font-bold">TOTAL</TableCell>
                            <TableCell className="text-right font-bold text-green-600">{formatRupiah(batch.totalAmount)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
