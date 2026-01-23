"use client";

import { useState, useEffect, useCallback } from "react";
import { formatRupiah, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { toast } from "sonner";
import { 
  DollarSign, 
  TrendingUp, 
  CreditCard, 
  Wallet,
  Search,
  Download
} from "lucide-react";

interface ReportSummary {
  totalTransactions: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  grossMargin: number;
}

interface TransactionReportItem {
  id: string;
  invoiceNumber: string | null;
  date: string;
  customerName: string;
  paymentMethod: string;
  itemCount: number;
  total: number;
  cost: number;
  profit: number;
  marginPercent: number;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 10);
  });
  
  const [summary, setSummary] = useState<ReportSummary>({
    totalTransactions: 0,
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    grossMargin: 0
  });
  
  const [transactions, setTransactions] = useState<TransactionReportItem[]>([]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        startDate: startDate,
        endDate: endDate
      });
      
      const response = await fetch(`/api/reports/sales?${queryParams}`);
      if (!response.ok) throw new Error("Gagal mengambil data laporan");
      
      const data = await response.json();
      setSummary(data.summary);
      setTransactions(data.transactions);
      
      toast.success("Laporan berhasil dimuat");
    } catch (error) {
      console.error(error);
      toast.error("Gagal memuat laporan");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]); // Load initial data (today)

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Laporan Keuangan</h1>
          <p className="text-muted-foreground mt-1">
            Analisis detail penjualan, modal (HPP), dan laba bersih.
          </p>
        </div>
        
        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Dari Tanggal</label>
            <Input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full sm:w-[150px]"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Sampai Tanggal</label>
            <Input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full sm:w-[150px]"
            />
          </div>
          <Button onClick={fetchReport} disabled={loading}>
            {loading ? "Memuat..." : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Tampilkan
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Omset</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRupiah(summary.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              {summary.totalTransactions} Transaksi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Modal (HPP)</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRupiah(summary.totalCost)}</div>
            <p className="text-xs text-muted-foreground">
              Cost of Goods Sold
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Laba Bersih</CardTitle>
            <Wallet className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRupiah(summary.totalProfit)}</div>
            <p className="text-xs text-muted-foreground">
              (Omset - Modal)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margin Keuntungan</CardTitle>
            <TrendingUp className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.grossMargin.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Rata-rata Margin
            </p>
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
                  <TableHead className="text-right">Total Modal</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      Memuat data...
                    </TableCell>
                  </TableRow>
                ) : transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      Tidak ada transaksi pada periode ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <div className="font-medium">{tx.invoiceNumber || '-'}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(tx.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • {formatDate(tx.date)}
                        </div>
                      </TableCell>
                      <TableCell>{tx.customerName}</TableCell>
                      <TableCell>
                        <span className="capitalize">{tx.paymentMethod.replace('_', ' ')}</span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatRupiah(tx.total)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatRupiah(tx.cost)}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${tx.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatRupiah(tx.profit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          tx.marginPercent >= 20 ? 'bg-emerald-100 text-emerald-800' : 
                          tx.marginPercent >= 10 ? 'bg-amber-100 text-amber-800' : 
                          'bg-red-100 text-red-800'
                        }`}>
                          {tx.marginPercent.toFixed(1)}%
                        </span>
                      </TableCell>
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