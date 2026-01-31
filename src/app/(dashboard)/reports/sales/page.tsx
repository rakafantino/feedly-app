"use client";

import { useState } from "react";
import { formatRupiah, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, CreditCard, Wallet, Search, Download, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { TableSkeleton } from "@/components/skeleton";
import { useQuery, keepPreviousData } from "@tanstack/react-query";

interface ReportSummary {
  totalTransactions: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  grossMargin: number;
  totalCashReceived: number;
  totalUnpaid: number;
  totalDiscount: number;
}

interface TransactionReportItem {
  id: string;
  invoiceNumber: string | null;
  date: string;
  customerName: string;
  paymentMethod: string;
  itemCount: number;
  total: number;
  discount: number;
  cost: number;
  profit: number;
  marginPercent: number;
}

interface TransactionDetail {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  customer: { name: string } | null;
  paymentMethod: string;
  total: number;
  discount: number;
  items: {
    id: string;
    product: { name: string };
    quantity: number;
    price: number;
  }[];
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const INITIAL_SUMMARY: ReportSummary = {
  totalTransactions: 0,
  totalRevenue: 0,
  totalCost: 0,
  totalProfit: 0,
  grossMargin: 0,
  totalCashReceived: 0,
  totalUnpaid: 0,
  totalDiscount: 0,
};

export default function SalesReportPage() {
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    // Start of month local time
    return new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('sv-SE');
  });
  const [endDate, setEndDate] = useState(() => {
    // Today local time
    return new Date().toLocaleDateString('sv-SE');
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  
  // Detail View State
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Fetch Report Data
  const { data: reportData, isLoading, isPlaceholderData } = useQuery({
    queryKey: ['sales-report', { startDate, endDate, page: currentPage }],
    queryFn: async () => {
      const queryParams = new URLSearchParams({
        startDate,
        endDate,
        page: currentPage.toString(),
        limit: "10",
      });
      const res = await fetch(`/api/reports/sales?${queryParams}`);
      if (!res.ok) throw new Error("Gagal mengambil data laporan");
      return res.json();
    },
    placeholderData: keepPreviousData,
  });

  const summary: ReportSummary = reportData?.summary || INITIAL_SUMMARY;
  const transactions: TransactionReportItem[] = reportData?.transactions || [];
  const pagination: PaginationData | null = reportData?.pagination || null;

  // Fetch Transaction Detail
  const { data: selectedTransaction, isLoading: detailLoading } = useQuery({
    queryKey: ['transaction', selectedTransactionId],
    queryFn: async () => {
      if (!selectedTransactionId) return null;
      const res = await fetch(`/api/transactions/${selectedTransactionId}`);
      if (!res.ok) throw new Error("Gagal mengambil detail transaksi");
      const data = await res.json();
      return data.transaction as TransactionDetail;
    },
    enabled: !!selectedTransactionId && isDetailOpen,
  });

  const handleRowClick = (id: string) => {
    setSelectedTransactionId(id);
    setIsDetailOpen(true);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  return (
    <div className="container mx-auto sm:p-6 space-y-6 sm:space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Laporan Penjualan</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Analisis detail penjualan, modal (HPP), dan laba bersih.</p>
        </div>

        {/* Filter Controls */}
        <div className="w-full md:w-auto grid grid-cols-2 md:flex flex-row gap-3 items-end">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Dari Tanggal</label>
            <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }} className="w-full" />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Sampai Tanggal</label>
            <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }} className="w-full" />
          </div>
          <div className="col-span-2 md:w-auto">
             {/* Search button is redundant as updates are reactive, but kept for UI consistency/manual refresh feel if needed, 
                 or we can remove it. Let's keep it as a "Refresh" or just remove triggers. 
                 Actually, modifying date already triggers fetch. So button is visual only for now 
                 or could force refetch. Let's make it just trigger fetch? No, auto-fetch on date change is better.
                 But Button says "Tampilkan". 
                 If I keep it, I should making 'startDate' state separate from 'filterStartDate'?
                 For now, let's keep it simple: Changing input updates state -> triggers fetch. Button effectively does nothing or re-fetches. */}
            <Button onClick={() => {}} disabled={isLoading} className="w-full md:w-auto">
                {isLoading && !isPlaceholderData ? (
                "Memuat..."
                ) : (
                <>
                    <Search className="w-4 h-4 mr-2" />
                    Tampilkan
                </>
                )}
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="flex overflow-x-auto pb-4 -mx-4 px-4 gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible sm:mx-0 sm:px-0 scrollbar-hide">
        <Card className="min-w-[280px] sm:min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Penjualan</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRupiah(summary.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">Nilai barang terjual (Tunai + Hutang)</p>
          </CardContent>
        </Card>

        <Card className="min-w-[280px] sm:min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uang Masuk</CardTitle>
            <Wallet className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRupiah(summary.totalCashReceived)}</div>
            <p className="text-xs text-muted-foreground">Cash/Transfer yang diterima</p>
          </CardContent>
        </Card>

        <Card className="min-w-[280px] sm:min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Piutang Tertunda</CardTitle>
            <CreditCard className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRupiah(summary.totalUnpaid)}</div>
            <p className="text-xs text-muted-foreground">Penjualan yang belum dibayar</p>
          </CardContent>
        </Card>

        <Card className="min-w-[280px] sm:min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Laba Kotor</CardTitle>
            <TrendingUp className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRupiah(summary.totalProfit)}</div>
            <p className="text-xs text-muted-foreground">(Total Penjualan - Modal)</p>
          </CardContent>
        </Card>

        <Card className="min-w-[280px] sm:min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Diskon</CardTitle>
            <DollarSign className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRupiah(summary.totalDiscount)}</div>
            <p className="text-xs text-muted-foreground">Potongan harga diberikan</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Rincian Transaksi</CardTitle>
          <Button variant="outline" size="sm" disabled>
            <Download className="w-4 h-4 mr-2" />
            Export CSV (Soon)
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice / Tanggal</TableHead>
                  <TableHead>Pelanggan</TableHead>
                  <TableHead>Metode</TableHead>
                  <TableHead className="text-right">Total Transaksi</TableHead>
                  <TableHead className="text-right">Total Diskon</TableHead>
                  <TableHead className="text-right">Total Modal</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableSkeleton columnCount={8} rowCount={5} showHeader={false} />
                ) : transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      Tidak ada transaksi pada periode ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => (
                    <TableRow 
                      key={tx.id} 
                      className={`cursor-pointer hover:bg-muted/50 ${isPlaceholderData ? "opacity-50" : ""}`}
                      onClick={() => handleRowClick(tx.id)}
                    >
                      <TableCell>
                        <div className="font-medium">{tx.invoiceNumber || "-"}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(tx.date).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} • {formatDate(tx.date)}
                        </div>
                      </TableCell>
                      <TableCell>{tx.customerName}</TableCell>
                      <TableCell>
                        <span className="capitalize">{tx.paymentMethod.replace("_", " ")}</span>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatRupiah(tx.total)}</TableCell>
                      <TableCell className="text-right text-red-600">{tx.discount > 0 ? `-${formatRupiah(tx.discount)}` : "-"}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatRupiah(tx.cost)}</TableCell>
                      <TableCell className={`text-right font-bold ${tx.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatRupiah(tx.profit)}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            tx.marginPercent >= 20 ? "bg-emerald-100 text-emerald-800" : tx.marginPercent >= 10 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
                          }`}
                        >
                          {tx.marginPercent.toFixed(1)}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination UI */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex flex-col gap-3 pt-4 border-t mt-4">
              {/* Info text - always visible */}
              <div className="text-sm text-muted-foreground text-center sm:text-left">
                Menampilkan <span className="font-medium text-foreground">{((currentPage - 1) * pagination.limit) + 1} - {Math.min(currentPage * pagination.limit, pagination.total)}</span> dari <span className="font-medium text-foreground">{pagination.total}</span> transaksi
              </div>
              
              {/* Navigation controls */}
              <div className="flex items-center justify-center sm:justify-end gap-2">
                {/* Previous button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
                  disabled={currentPage === 1 || isLoading}
                  className="flex-1 sm:flex-none"
                >
                  <ChevronLeft className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Sebelumnya</span>
                </Button>
                
                {/* Page numbers - Desktop only */}
                <div className="hidden sm:flex items-center space-x-1">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter((page) => {
                      return page === 1 || page === pagination.totalPages || 
                        (page >= currentPage - 1 && page <= currentPage + 1);
                    })
                    .map((page, index, array) => (
                      <span key={page} className="flex items-center">
                        {index > 0 && array[index - 1] !== page - 1 && (
                          <span className="px-2 text-muted-foreground">...</span>
                        )}
                        <Button
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(page)}
                          className="w-9"
                          disabled={isLoading}
                        >
                          {page}
                        </Button>
                      </span>
                    ))}
                </div>
                
                {/* Page indicator - Mobile */}
                <div className="sm:hidden flex items-center gap-1 px-3 py-1.5 bg-muted rounded-md">
                  <span className="font-medium">{currentPage}</span>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-muted-foreground">{pagination.totalPages}</span>
                </div>
                
                {/* Next button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(Math.min(currentPage + 1, pagination.totalPages))}
                  disabled={currentPage === pagination.totalPages || isLoading}
                  className="flex-1 sm:flex-none"
                >
                  <span className="hidden sm:inline">Selanjutnya</span>
                  <ChevronRight className="h-4 w-4 sm:ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md w-full">
          <SheetHeader>
            <SheetTitle>Detail Transaksi</SheetTitle>
            <SheetDescription>
              Invoice: {selectedTransaction?.invoiceNumber || "-"}
            </SheetDescription>
          </SheetHeader>

          {detailLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : selectedTransaction ? (
            <div className="space-y-6 mt-6">
              {/* Info Utama */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-xs text-muted-foreground block">Tanggal</label>
                  <span className="font-medium">{formatDate(selectedTransaction.createdAt)}</span>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block">Pelanggan</label>
                  <span className="font-medium">{selectedTransaction.customer?.name || "Guest"}</span>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block">Metode Pembayaran</label>
                  <Badge variant="outline" className="mt-1 capitalize">
                    {selectedTransaction.paymentMethod.replace("_", " ")}
                  </Badge>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Item Pembelian</h4>
                <div className="space-y-3">
                  {selectedTransaction.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-start text-sm pb-3 border-b border-border/50 last:border-0 last:pb-0">
                      <div>
                        <p className="font-medium max-w-[180px] break-words">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} x {formatRupiah(item.price)}
                        </p>
                      </div>
                      <div className="font-medium">
                        {formatRupiah(item.quantity * item.price)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>
                    {formatRupiah(
                      selectedTransaction.items.reduce((sum, item) => sum + item.quantity * item.price, 0)
                    )}
                  </span>
                </div>
                {selectedTransaction.discount > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span>Diskon</span>
                    <span>-{formatRupiah(selectedTransaction.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                  <span>Total</span>
                  <span>{formatRupiah(selectedTransaction.total)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              Data tidak tersedia
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
