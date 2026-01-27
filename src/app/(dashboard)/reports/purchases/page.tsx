"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Search, ShoppingCart, TrendingDown, Download } from "lucide-react";

interface PurchaseReportSummary {
  totalSpend: number;
  totalTransactions: number;
  averageSpend: number;
}

interface PurchaseReportItem {
  id: string;
  poNumber: string;
  date: string;
  supplierName: string;
  status: string;
  itemCount: number;
  total: number;
}

export default function PurchaseReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    // Start of month local time
    return new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('sv-SE');
  });
  const [endDate, setEndDate] = useState(() => {
    // Today local time
    return new Date().toLocaleDateString('sv-SE');
  });

  const [summary, setSummary] = useState<PurchaseReportSummary>({
    totalSpend: 0,
    totalTransactions: 0,
    averageSpend: 0,
  });

  const [items, setItems] = useState<PurchaseReportItem[]>([]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        startDate: startDate,
        endDate: endDate,
      });

      const response = await fetch(`/api/reports/purchases?${queryParams}`);
      if (!response.ok) throw new Error("Gagal mengambil data laporan");

      const data = await response.json();
      setSummary(data.summary);
      setItems(data.items);
    } catch (error) {
      console.error(error);
      toast.error("Gagal memuat laporan");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Laporan Pembelian</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Rekap pengeluaran belanja (Purchase Orders) ke Supplier.</p>
        </div>

        {/* Filter Controls */}
        <div className="w-full md:w-auto grid grid-cols-2 md:flex flex-row gap-3 items-end">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Dari Tanggal</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full" />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Sampai Tanggal</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full" />
          </div>
          <div className="col-span-2 md:w-auto">
            <Button onClick={fetchReport} disabled={loading} className="w-full md:w-auto">
                {loading ? (
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
      <div className="flex overflow-x-auto pb-4 -mx-4 px-4 gap-4 sm:grid sm:grid-cols-3 sm:overflow-visible sm:mx-0 sm:px-0 scrollbar-hide">
        <Card className="min-w-[280px] sm:min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pengeluaran</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRupiah(summary.totalSpend)}</div>
            <p className="text-xs text-muted-foreground">Total belanja stok (PO Completed)</p>
          </CardContent>
        </Card>

        <Card className="min-w-[280px] sm:min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transaksi</CardTitle>
            <ShoppingCart className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalTransactions}</div>
            <p className="text-xs text-muted-foreground">Jumlah PO</p>
          </CardContent>
        </Card>

        <Card className="min-w-[280px] sm:min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rata-rata Belanja</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRupiah(summary.averageSpend)}</div>
            <p className="text-xs text-muted-foreground">Per Purchase Order</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Rincian Pembelian (PO)</CardTitle>
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
                  <TableHead>No. PO / Tanggal</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Item Diterima</TableHead>
                  <TableHead className="text-right">Total Belanja</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Memuat data...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      Tidak ada data pembelian pada periode ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow 
                      key={item.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/purchase-orders/${item.id}`)}
                    >
                      <TableCell>
                        <div className="font-medium">{item.poNumber}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(item.date)}</div>
                      </TableCell>
                      <TableCell>{item.supplierName}</TableCell>
                      <TableCell>
                        {(() => {
                          const s = item.status?.toLowerCase();
                          if (s === 'ordered') return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Dipesan</span>;
                          if (s === 'partially_received') return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Diterima Sebagian</span>;
                          if (s === 'received') return <span className="px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Diterima</span>;
                          if (s === 'cancelled') return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Dibatalkan</span>;
                          return <span className="capitalize px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{item.status}</span>;
                        })()}
                      </TableCell>
                      <TableCell className="text-right">{item.itemCount}</TableCell>
                      <TableCell className="text-right font-bold text-red-600">{formatRupiah(item.total)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper icon
import { DollarSign } from "lucide-react";
