"use client";

import { useState, useEffect, useCallback } from "react";
import { formatRupiah, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Search, Trash2, RefreshCw, FileText, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/components/providers/store-provider";

interface AdjustmentItem {
  id: string;
  storeId: string;
  productId: string;
  batchId: string | null;
  quantity: number;
  type: string;
  reason: string | null;
  costPerUnit: number;
  totalValue: number;
  createdAt: string;
  product: {
    name: string;
    unit: string;
  };
  batch: {
    batchNumber: string | null;
    expiryDate: string | null;
  } | null;
  createdBy: {
    name: string | null;
  } | null;
}

interface ReportSummary {
  totalItems: number;
  totalLossValue: number;
  totalCorrectionValue: number;
}

export default function StockAdjusmentReportPage() {
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    // Start of month local time
    return new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('sv-SE'); // YYYY-MM-DD
  });
  const [endDate, setEndDate] = useState(() => {
    // Today local time
    return new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
  });
  const [filterType, setFilterType] = useState('ALL');

  const [summary, setSummary] = useState<ReportSummary>({
    totalItems: 0,
    totalLossValue: 0,
    totalCorrectionValue: 0,
  });

  const [adjustments, setAdjustments] = useState<AdjustmentItem[]>([]);

  const { selectedStore } = useStore();
  // Get ID from provider or cookie fallback
  const storeId = selectedStore?.id; 

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        startDate: startDate,
        endDate: endDate,
        type: filterType
      });
      
      if (storeId) {
        queryParams.append('storeId', storeId);
      }

      const response = await fetch(`/api/reports/adjustments?${queryParams}`);
      if (!response.ok) throw new Error("Gagal mengambil data laporan");

      const data = await response.json();
      setSummary(data.summary);
      setAdjustments(data.adjustments);

    } catch (error) {
      console.error(error);
      toast.error("Gagal memuat laporan");
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filterType, storeId]);

  useEffect(() => {
    if (storeId) {
       fetchReport();
    }
  }, [fetchReport, storeId]);

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'WASTE': return 'destructive';
      case 'EXPIRED': return 'destructive';
      case 'DAMAGED': return 'destructive';
      case 'CORRECTION': return 'default'; // blue-ish usually
      default: return 'secondary';
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Laporan Penyesuaian Stok</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
             Pencatatan pemusnahan barang (waste), barang rusak, kadaluarsa, dan koreksi stok.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="w-full md:w-auto grid grid-cols-2 md:flex flex-row gap-3 items-end">
           <div className="col-span-2 md:w-[150px] grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tipe</label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Semua Tipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Tipe</SelectItem>
                <SelectItem value="WASTE">Limbah (Waste)</SelectItem>
                <SelectItem value="EXPIRED">Kadaluarsa</SelectItem>
                <SelectItem value="DAMAGED">Rusak</SelectItem>
                <SelectItem value="CORRECTION">Koreksi Stok</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                {loading ? "Memuat..." : (
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
      {/* Summary Cards */}
      <div className="flex overflow-x-auto pb-4 -mx-4 px-4 gap-4 sm:grid sm:grid-cols-3 sm:overflow-visible sm:mx-0 sm:px-0 scrollbar-hide">
        <Card className="min-w-[280px] sm:min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Nilai Kerugian</CardTitle>
            <Trash2 className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatRupiah(summary.totalLossValue)}</div>
            <p className="text-xs text-muted-foreground">Estimasi nilai barang hilang/rusak (HPP)</p>
          </CardContent>
        </Card>

        <Card className="min-w-[280px] sm:min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Item Disesuaikan</CardTitle>
            <RefreshCw className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalItems}</div>
            <p className="text-xs text-muted-foreground">Total unit barang yang disesuaikan</p>
          </CardContent>
        </Card>
        
        <Card className="min-w-[280px] sm:min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nilai Koreksi Positif</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" /> {/* Reused import? Wait, need to check imports */}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatRupiah(summary.totalCorrectionValue)}</div>
            <p className="text-xs text-muted-foreground">Penambahan stok manual</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Riwayat Penyesuaian
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal / Waktu</TableHead>
                  <TableHead>Produk</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                  <TableHead className="text-right">Nilai (HPP)</TableHead>
                  <TableHead>Alasan / User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">Memuat data...</TableCell>
                  </TableRow>
                ) : adjustments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">Tidak ada data.</TableCell>
                  </TableRow>
                ) : (
                  adjustments.map((adj) => (
                    <TableRow key={adj.id}>
                      <TableCell>
                         <div className="font-medium">{formatDate(adj.createdAt)}</div>
                         <div className="text-xs text-muted-foreground">
                            {new Date(adj.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                         </div>
                      </TableCell>
                      <TableCell>
                          <div className="font-medium">{adj.product.name}</div>
                      </TableCell>
                      <TableCell>
                          {adj.batch ? (
                              <div className="flex flex-col">
                                  <span className="text-sm font-medium">{adj.batch.batchNumber || '-'}</span>
                                  {adj.batch.expiryDate && (
                                      <span className="text-[10px] text-muted-foreground">
                                          Exp: {formatDate(adj.batch.expiryDate)}
                                      </span>
                                  )}
                              </div>
                          ) : '-'}
                      </TableCell>
                      <TableCell>
                          <Badge variant={getTypeColor(adj.type) as any}>
                              {adj.type}
                          </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-medium ${adj.quantity < 0 ? "text-red-600" : "text-emerald-600"}`}>
                          {adj.quantity > 0 ? '+' : ''}{adj.quantity} {adj.product.unit}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                          {formatRupiah(Math.abs(adj.totalValue))}
                      </TableCell>
                      <TableCell>
                          <div className="max-w-[200px] truncate" title={adj.reason || ''}>
                             {adj.reason || '-'}
                          </div>
                          <div className="text-xs text-muted-foreground text-opacity-70 mt-0.5">
                             Oleh: {adj.createdBy?.name || 'System'}
                          </div>
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


