"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatRupiah, formatDate } from "@/lib/utils";
import { History, ChevronRight, ArrowDownLeft } from "lucide-react";

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

interface PurchaseReturn {
  id: string;
  totalAmount: number;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  poId: string | null;
  poNumber: string;
}

type HistoryEntryType = "payment" | "return";

interface HistoryEntry {
  id: string;
  type: HistoryEntryType;
  date: string;
  amount: number;
  paymentMethod?: string;
  poNumber: string;
  notes?: string | null;
  reason?: string | null;
  paymentCount?: number;
  payments?: {
    id: string;
    amount: number;
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
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [paymentsRes, returnsRes] = await Promise.all([fetch(`/api/suppliers/${supplierId}/batch-payments`), fetch(`/api/suppliers/${supplierId}/purchase-returns`)]);

      if (!paymentsRes.ok) throw new Error("Gagal mengambil riwayat pembayaran");
      if (!returnsRes.ok) throw new Error("Gagal mengambil riwayat retur");

      const paymentsData = await paymentsRes.json();
      const returnsData = await returnsRes.json();

      setBatchPayments(paymentsData);
      setPurchaseReturns(returnsData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const combinedHistory: HistoryEntry[] = [
    ...batchPayments.map((bp) => ({
      id: bp.id,
      type: "payment" as HistoryEntryType,
      date: bp.createdAt,
      amount: bp.totalAmount,
      paymentMethod: bp.paymentMethod,
      poNumber: bp.payments.length > 0 ? `${bp.paymentCount} PO` : "-",
      notes: bp.notes,
      paymentCount: bp.paymentCount,
      payments: bp.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        poNumber: p.poNumber,
      })),
    })),
    ...purchaseReturns.map((ret) => ({
      id: ret.id,
      type: "return" as HistoryEntryType,
      date: ret.createdAt,
      amount: ret.totalAmount,
      poNumber: ret.poNumber,
      notes: ret.notes,
      reason: ret.reason,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Riwayat Pembayaran & Retur
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Semua pembayaran dan retur untuk supplier: <span className="font-medium text-foreground">{supplierName}</span>
          </p>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Memuat...</div>
          ) : combinedHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Belum ada riwayat pembayaran atau retur.</div>
          ) : (
            <div className="space-y-3">
              {combinedHistory.map((entry) => (
                <div key={`${entry.type}-${entry.id}`} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => entry.type === "payment" && toggleExpand(entry.id)}>
                    <div className="flex items-center gap-3">
                      {entry.type === "payment" ? <ChevronRight className={`w-4 h-4 transition-transform ${expandedId === entry.id ? "rotate-90" : ""}`} /> : <ArrowDownLeft className="w-4 h-4 text-red-500" />}
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant={entry.type === "payment" ? "default" : "destructive"} className="text-xs">
                            {entry.type === "payment" ? "Bayar" : "Retur"}
                          </Badge>
                          {entry.type === "payment" && entry.paymentMethod && (
                            <Badge variant="outline" className="text-xs">
                              {entry.paymentMethod}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {formatDate(entry.date)} • {entry.poNumber}
                        </div>
                        {entry.type === "return" && entry.reason && <div className="text-xs text-muted-foreground mt-1">Alasan: {entry.reason}</div>}
                        {entry.notes && <div className="text-xs text-muted-foreground mt-1">{entry.notes}</div>}
                      </div>
                    </div>
                    <div className={`text-right font-medium ${entry.type === "return" ? "text-red-600" : "text-green-600"}`}>
                      {entry.type === "return" ? "-" : "+"}
                      {formatRupiah(entry.amount)}
                    </div>
                  </div>

                  {entry.type === "payment" && expandedId === entry.id && entry.payments && (
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
                          {entry.payments.map((payment) => (
                            <TableRow key={payment.id}>
                              <TableCell className="text-sm font-medium">{payment.poNumber}</TableCell>
                              <TableCell className="text-right text-sm text-green-600">{formatRupiah(payment.amount)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="border-t-2">
                            <TableCell className="font-bold">TOTAL</TableCell>
                            <TableCell className="text-right font-bold text-green-600">{formatRupiah(entry.amount)}</TableCell>
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
