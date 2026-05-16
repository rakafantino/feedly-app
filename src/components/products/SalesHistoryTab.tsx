"use client";

import { useEffect, useState } from "react";
import { formatRupiah } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";

interface SalesHistoryItem {
  id: string;
  transactionId: string;
  invoiceNumber: string | null;
  soldAt: string;
  customerName: string;
  paymentMethod: string;
  paymentStatus: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  lineTotal: number;
  profit: number;
}

interface SalesHistoryResponse {
  history: SalesHistoryItem[];
  summary: {
    totalQuantity: number;
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    averageSellingPrice: number;
    totalTransactions: number;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const ITEMS_PER_PAGE = 10;

export function SalesHistoryTab({ productId }: { productId: string }) {
  const [history, setHistory] = useState<SalesHistoryItem[]>([]);
  const [summary, setSummary] = useState<SalesHistoryResponse["summary"] | null>(null);
  const [pagination, setPagination] = useState<SalesHistoryResponse["pagination"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    fetch(`/api/products/${productId}/sales-history?page=${currentPage}&limit=${ITEMS_PER_PAGE}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal mengambil riwayat penjualan");
        return data as SalesHistoryResponse;
      })
      .then((data) => {
        if (!active) return;
        setHistory(data.history || []);
        setSummary(data.summary || null);
        setPagination(data.pagination || null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Gagal mengambil riwayat penjualan");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [productId, currentPage]);

  if (loading) return <div>Loading sales history...</div>;
  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (history.length === 0) return <div>Belum ada riwayat penjualan.</div>;

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Qty Terjual</p>
            <p className="text-lg font-semibold">{summary.totalQuantity.toLocaleString("id-ID")}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Omzet</p>
            <p className="text-lg font-semibold">{formatRupiah(summary.totalRevenue)}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Profit</p>
            <p className="text-lg font-semibold">{formatRupiah(summary.totalProfit)}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Transaksi</p>
            <p className="text-lg font-semibold">{summary.totalTransactions.toLocaleString("id-ID")}</p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 border">Tanggal</th>
              <th className="p-3 border">Invoice</th>
              <th className="p-3 border">Customer</th>
              <th className="p-3 border text-right">Qty</th>
              <th className="p-3 border text-right">Harga</th>
              <th className="p-3 border text-right">Total</th>
              <th className="p-3 border text-right">Profit</th>
              <th className="p-3 border">Pembayaran</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="p-3 border">{new Date(item.soldAt).toLocaleString("id-ID")}</td>
                <td className="p-3 border">{item.invoiceNumber || "-"}</td>
                <td className="p-3 border">{item.customerName}</td>
                <td className="p-3 border text-right">{item.quantity.toLocaleString("id-ID")}</td>
                <td className="p-3 border text-right">{formatRupiah(item.unitPrice)}</td>
                <td className="p-3 border text-right">{formatRupiah(item.lineTotal)}</td>
                <td className="p-3 border text-right">{formatRupiah(item.profit)}</td>
                <td className="p-3 border">
                  <Badge variant={item.paymentStatus === "PAID" ? "default" : "secondary"}>
                    {item.paymentMethod}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Menampilkan {(pagination.page - 1) * pagination.limit + 1}-
            {Math.min(pagination.page * pagination.limit, pagination.total)} dari {pagination.total} riwayat
          </p>
          <Pagination currentPage={pagination.page} totalPages={pagination.totalPages} onPageChange={setCurrentPage} />
        </div>
      )}
    </div>
  );
}
