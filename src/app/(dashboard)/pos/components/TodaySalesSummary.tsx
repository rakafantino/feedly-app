"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, Clock, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { format, startOfDay, endOfDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface TransactionItem {
  id: string;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
}

interface TodayTransaction {
  id: string;
  invoiceNumber: string;
  total: number;
  amountPaid: number;
  paymentMethod: string;
  createdAt: string;
  items: TransactionItem[];
}

interface TodaySalesSummary {
  transactions: TodayTransaction[];
  totalRevenue: number;
  transactionCount: number;
}

export function TodaySalesSummary() {
  const today = new Date();
  const startOfToday = format(startOfDay(today), "yyyy-MM-dd");
  const endOfToday = format(endOfDay(today), "yyyy-MM-dd");
  const [expandedTx, setExpandedTx] = useState<string | null>(null);

  const { data, isLoading } = useQuery<TodaySalesSummary>({
    queryKey: ["today-sales-summary"],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: startOfToday,
        endDate: endOfToday,
      });
      const res = await fetch(`/api/reports/sales-summary?${params}`);
      if (!res.ok) throw new Error("Gagal mengambil data");
      return res.json();
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Memuat ringkasan penjualan...
          </div>
        </CardContent>
      </Card>
    );
  }

  const summary = data || { totalRevenue: 0, transactionCount: 0, transactions: [] };

  return (
    <Card className="bg-linear-to-r from-slate-900 to-slate-800 text-white border-slate-700 shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Penjualan Hari Ini
          </CardTitle>
          <span className="text-xs text-slate-300">{format(today, "dd MMM yyyy", { locale: localeId })}</span>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold tracking-tight">{formatRupiah(summary.totalRevenue)}</p>
            <p className="text-xs text-slate-300 mt-1">{summary.transactionCount} transaksi</p>
          </div>

          {summary.transactions.length > 0 && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-slate-700 gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Riwayat
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:w-[500px] overflow-y-auto">
                <div className="space-y-4 pt-4">
                  <div>
                    <h3 className="font-semibold text-lg">Riwayat Transaksi Hari Ini</h3>
                    <p className="text-sm text-muted-foreground">{format(today, "EEEE, dd MMMM yyyy", { locale: localeId })}</p>
                  </div>

                  <div className="bg-muted rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Total Penjualan</span>
                      <span className="font-bold">{formatRupiah(summary.totalRevenue)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Jumlah Transaksi</span>
                      <span className="font-bold">{summary.transactionCount}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Detail Transaksi</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-xs w-8"></TableHead>
                            <TableHead className="text-xs">Waktu</TableHead>
                            <TableHead className="text-xs">Invoice</TableHead>
                            <TableHead className="text-xs">Metode</TableHead>
                            <TableHead className="text-right text-xs">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {summary.transactions.slice(0, 50).map((tx) => (
                            <Fragment key={tx.id}>
                              <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}>
                                <TableCell className="p-2">{expandedTx === tx.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</TableCell>
                                <TableCell className="text-xs">{format(new Date(tx.createdAt), "HH:mm")}</TableCell>
                                <TableCell className="text-xs font-medium">{tx.invoiceNumber}</TableCell>
                                <TableCell className="text-xs">
                                  <Badge variant="outline" className="text-xs">
                                    {tx.paymentMethod === "CASH" ? "Tunai" : "Transfer"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right text-xs font-medium text-green-600">{formatRupiah(tx.total)}</TableCell>
                              </TableRow>
                              {expandedTx === tx.id && (
                                <TableRow className="bg-muted/30">
                                  <TableCell colSpan={5} className="p-3">
                                    <div className="space-y-2">
                                      <p className="text-xs font-medium text-muted-foreground mb-2">Item Pembelian:</p>
                                      {tx.items && tx.items.length > 0 ? (
                                        <div className="space-y-1.5">
                                          {tx.items.map((item) => (
                                            <div key={item.id} className="flex justify-between items-center text-xs">
                                              <div className="flex-1">
                                                <span className="font-medium">{item.productName}</span>
                                                <span className="text-muted-foreground ml-2">
                                                  {item.quantity}x {formatRupiah(item.price)}
                                                </span>
                                              </div>
                                              <span className="font-medium text-right">{formatRupiah(item.subtotal)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-muted-foreground">Tidak ada detail item</p>
                                      )}
                                      <div className="flex justify-between items-center pt-2 border-t text-xs font-bold">
                                        <span>Total</span>
                                        <span className="text-green-600">{formatRupiah(tx.total)}</span>
                                      </div>
                                      {tx.amountPaid > tx.total && (
                                        <div className="flex justify-between items-center text-xs">
                                          <span className="text-muted-foreground">Dibayar</span>
                                          <span>{formatRupiah(tx.amountPaid)}</span>
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {summary.transactions.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Belum ada transaksi hari ini</p>}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
