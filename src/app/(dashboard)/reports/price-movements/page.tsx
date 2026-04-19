"use client";

import { useEffect, useState } from "react";
import { formatRupiah } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableRowSkeleton } from "@/components/skeleton";

export default function PriceMovementsPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("ALL");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/price-movements?priceType=${typeFilter}&limit=100`)
      .then(res => res.json())
      .then(data => {
        if (data.history) setHistory(data.history);
        setLoading(false);
      })
      .catch(error => {
        console.error("Failed to fetch price movements", error);
        setLoading(false);
      });
  }, [typeFilter]);

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Laporan Pergerakan Harga</h1>
          <p className="text-muted-foreground mt-1">Riwayat fluktuasi harga modal dari supplier dan harga jual ke pelanggan.</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Filter Tipe:</span>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Pilih Tipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Semua Pergerakan</SelectItem>
              <SelectItem value="PURCHASE">Harga Beli (Modal)</SelectItem>
              <SelectItem value="SELLING">Harga Jual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Harga</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Produk</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead className="text-right">Harga Lama</TableHead>
                  <TableHead className="text-right">Harga Baru</TableHead>
                  <TableHead className="text-right">Selisih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRowSkeleton columnCount={6} rowCount={5} />
                ) : history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      Tidak ada pergerakan harga.
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map(item => {
                    const isIncrease = item.changeAmount > 0;
                    const textColor = isIncrease ? "text-red-600" : "text-green-600";
                    return (
                      <TableRow key={item.id} className="hover:bg-slate-50 transition-colors">
                        <TableCell className="whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleString('id-ID', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </TableCell>
                        <TableCell className="font-medium">{item.product.name}</TableCell>
                        <TableCell>
                          <Badge variant={item.priceType === 'PURCHASE' ? 'outline' : 'default'}>
                            {item.priceType === 'PURCHASE' ? 'Beli (Modal)' : 'Jual'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatRupiah(item.oldPrice)}</TableCell>
                        <TableCell className="text-right font-medium">{formatRupiah(item.newPrice)}</TableCell>
                        <TableCell className={`text-right font-medium ${textColor}`}>
                          {isIncrease ? "+" : ""}{formatRupiah(item.changeAmount)} 
                          <span className="text-xs ml-1">({isIncrease ? "+" : ""}{item.changePercentage}%)</span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
