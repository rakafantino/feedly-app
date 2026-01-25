"use client";

import { useState, useEffect, useCallback } from "react";
import { formatRupiah } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Package, DollarSign, Download, AlertCircle } from "lucide-react";

interface InventorySummary {
  totalValuation: number;
  totalItems: number;
}

interface InventoryItem {
  id: string;
  code: string | null;
  name: string;
  stock: number;
  unit: string;
  avgBuyPrice: number;
  totalValue: number;
}

export default function InventoryReportPage() {
  const [loading, setLoading] = useState(false);

  const [summary, setSummary] = useState<InventorySummary>({
    totalValuation: 0,
    totalItems: 0,
  });

  const [items, setItems] = useState<InventoryItem[]>([]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/reports/inventory");
      if (!response.ok) throw new Error("Gagal mengambil data laporan");

      const data = await response.json();
      setSummary(data.summary);
      setItems(data.items);
    } catch (error) {
      console.error(error);
      toast.error("Gagal memuat laporan stok");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Laporan Nilai Stok (Valuation)</h1>
          <p className="text-muted-foreground mt-1">Analisis total aset barang yang tersimpan di gudang berdasarkan harga beli.</p>
        </div>

        <Button variant="outline" size="sm" disabled>
          <Download className="w-4 h-4 mr-2" />
          Export CSV (Soon)
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Nilai Aset</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRupiah(summary.totalValuation)}</div>
            <p className="text-xs text-muted-foreground">Estimasi modal terikat di stok</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Item Produk</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalItems}</div>
            <p className="text-xs text-muted-foreground">Jumlah SKU unik</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Rincian Stok Barang</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Stok Aktual</TableHead>
                  <TableHead className="text-right">Harga Beli (Avg)</TableHead>
                  <TableHead className="text-right">Total Nilai</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Memuat data...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Belum ada data stok.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{item.code || "-"}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.stock} <span className="text-muted-foreground text-xs">{item.unit}</span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {item.avgBuyPrice > 0 ? (
                          formatRupiah(item.avgBuyPrice)
                        ) : (
                          <span className="flex items-center justify-end gap-1 text-amber-500">
                            <AlertCircle className="w-3 h-3" />
                            Belum Set
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">{formatRupiah(item.totalValue)}</TableCell>
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
