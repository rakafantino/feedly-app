"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { FormattedNumberInput } from "@/components/ui/formatted-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil } from "lucide-react"; // Icons for edit

interface DebtTransaction {
  id: string;
  invoiceNumber: string;
  total: number;
  amountPaid: number;
  remainingAmount: number;
  createdAt: string;
  paymentStatus: string;
  dueDate?: string; // Add dueDate to interface
}

interface CustomerDebt {
  customer: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
  totalDebt: number;
  transactions: DebtTransaction[];
}

export default function DebtReportPage() {
  const [data, setData] = useState<CustomerDebt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [totalOutstanding, setTotalOutstanding] = useState(0);

  // Pay Modal State
  const [selectedTransaction, setSelectedTransaction] = useState<DebtTransaction | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Due Date Modal State
  const [isEditDateModalOpen, setIsEditDateModalOpen] = useState(false);
  const [newDueDate, setNewDueDate] = useState<string>("");

  const fetchReport = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/reports/debt");
      if (!res.ok) throw new Error("Gagal mengambil laporan");
      const json = await res.json();
      setData(json.data || []);
      setTotalOutstanding(json.totalOutstanding || 0);
    } catch (error) {
      console.error(error);
      toast.error("Gagal memuat laporan piutang");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const filteredData = data.filter((item) => {
    const custName = item.customer?.name?.toLowerCase() || "tanpa nama";
    return custName.includes(searchQuery.toLowerCase());
  });

  const handlePayClick = (transaction: DebtTransaction) => {
    setSelectedTransaction(transaction);
    setPaymentAmount(transaction.remainingAmount.toString()); // Default to full remaining
    setIsPayModalOpen(true);
  };

  const handleProcessPayment = async () => {
    if (!selectedTransaction) return;

    try {
      setIsSubmitting(true);
      const amount = parseFloat(paymentAmount.replace(/[^\d]/g, ""));

      const res = await fetch(`/api/transactions/${selectedTransaction.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          paymentMethod,
          notes: "Pelunasan via Laporan",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal memproses pembayaran");
      }

      toast.success("Pembayaran berhasil dicatat");
      setIsPayModalOpen(false);
      fetchReport(); // Refresh data
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditDateClick = (transaction: DebtTransaction) => {
    setSelectedTransaction(transaction);
    // Format existing due date or default to empty
    const currentDueDate = transaction.dueDate ? new Date(transaction.dueDate).toISOString().split('T')[0] : "";
    setNewDueDate(currentDueDate);
    setIsEditDateModalOpen(true);
  };

  const handleProcessEditDate = async () => {
    if (!selectedTransaction || !newDueDate) return;

    try {
        setIsSubmitting(true);
        const res = await fetch(`/api/transactions/${selectedTransaction.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dueDate: newDueDate })
        });

        if (!res.ok) throw new Error("Gagal memperbarui tanggal");
        
        toast.success("Tanggal jatuh tempo diperbarui");
        setIsEditDateModalOpen(false);
        fetchReport();
    } catch (error: any) {
        toast.error(error.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Laporan Piutang Pelanggan</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Piutang Belum Lunas</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(totalOutstanding)}</div>
            <p className="text-xs text-muted-foreground">Dari {data.length} pelanggan yg memiliki hutang</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari pelanggan..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredData.map((item, idx) => (
            <Card key={idx} className="overflow-hidden">
              <CardHeader className="bg-muted/50 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{item.customer?.name || "Tanpa Nama"}</CardTitle>
                    <p className="text-sm text-muted-foreground">{item.customer?.phone || "-"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">Total Hutang</p>
                    <p className="text-lg font-bold text-red-600">{formatCurrency(item.totalDebt)}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Total Tagihan</TableHead>
                      <TableHead>Sudah Bayar</TableHead>
                      <TableHead>Sisa Hutang</TableHead>
                      <TableHead>Jatuh Tempo</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {item.transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-medium">{tx.invoiceNumber}</TableCell>
                        <TableCell>{new Date(tx.createdAt).toLocaleDateString("id-ID")}</TableCell>
                        <TableCell>{formatCurrency(tx.total)}</TableCell>
                        <TableCell>{formatCurrency(tx.amountPaid)}</TableCell>
                        <TableCell className="text-red-500 font-bold">{formatCurrency(tx.remainingAmount)}</TableCell>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                <span>{tx.dueDate ? new Date(tx.dueDate).toLocaleDateString('id-ID') : '-'}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditDateClick(tx)}>
                                    <Pencil className="h-3 w-3" />
                                </Button>
                            </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => handlePayClick(tx)}>
                            Bayar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
          {filteredData.length === 0 && <div className="text-center py-8 text-muted-foreground">Tidak ada data piutang ditemukan.</div>}
        </div>
      )}

      {/* Pay Modal */}
      <Dialog open={isPayModalOpen} onOpenChange={setIsPayModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pelunasan Hutang</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>No. Invoice</Label>
              <div className="font-medium">{selectedTransaction?.invoiceNumber}</div>
            </div>
            <div className="space-y-1">
              <Label>Sisa Hutang</Label>
              <div className="font-bold text-red-600">{selectedTransaction && formatCurrency(selectedTransaction.remainingAmount)}</div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="payAmount">Jumlah Bayar</Label>
              <FormattedNumberInput id="payAmount" value={paymentAmount} onChange={setPaymentAmount} placeholder="Masukkan jumlah pelunasan" />
            </div>

            <div className="space-y-1">
              <Label>Metode Pembayaran</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Tunai</SelectItem>
                  <SelectItem value="TRANSFER">Transfer</SelectItem>
                  <SelectItem value="QRIS">QRIS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPayModalOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleProcessPayment} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Proses Pelunasan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isEditDateModalOpen} onOpenChange={setIsEditDateModalOpen}>
        <DialogContent className="sm:max-w-sm">
            <DialogHeader>
                <DialogTitle>Ubah Jatuh Tempo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-1">
                    <Label>Pelanggan</Label>
                    <div className="font-medium text-sm text-muted-foreground">{selectedTransaction?.invoiceNumber}</div>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="newDueDate">Tanggal Jatuh Tempo Baru</Label>
                    <Input 
                        type="date" 
                        id="newDueDate" 
                        value={newDueDate} 
                        onChange={(e) => setNewDueDate(e.target.value)} 
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDateModalOpen(false)}>Batal</Button>
                <Button onClick={handleProcessEditDate} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Simpan"}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
