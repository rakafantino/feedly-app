"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupiah } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";

interface PurchaseHistoryItem {
  id: string;
  purchaseOrderId: string;
  poNumber: string;
  supplierName: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  estimatedDelivery: string | null;
  quantityOrdered: number;
  receivedQuantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

interface PurchaseHistoryResponse {
  history: PurchaseHistoryItem[];
  summary: {
    totalOrdered: number;
    totalReceived: number;
    totalAmount: number;
    totalPurchaseOrders: number;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const ITEMS_PER_PAGE = 10;

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Draft",
    ordered: "Dipesan",
    partially_received: "Diterima Sebagian",
    received: "Diterima",
    cancelled: "Dibatalkan",
  };
  return labels[status] || status;
}

export function PurchaseHistoryTab({ productId }: { productId: string }) {
  const router = useRouter();
  const [history, setHistory] = useState<PurchaseHistoryItem[]>([]);
  const [summary, setSummary] = useState<PurchaseHistoryResponse["summary"] | null>(null);
  const [pagination, setPagination] = useState<PurchaseHistoryResponse["pagination"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    fetch(`/api/products/${productId}/purchase-history?page=${currentPage}&limit=${ITEMS_PER_PAGE}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Gagal mengambil riwayat PO");
        return data as PurchaseHistoryResponse;
      })
      .then((data) => {
        if (!active) return;
        setHistory(data.history || []);
        setSummary(data.summary || null);
        setPagination(data.pagination || null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Gagal mengambil riwayat PO");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [productId, currentPage]);

  if (loading) return <div>Loading purchase history...</div>;
  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (history.length === 0) return <div>Belum ada riwayat PO untuk produk ini.</div>;

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Qty Dipesan</p>
            <p className="text-lg font-semibold">{summary.totalOrdered.toLocaleString("id-ID")}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Qty Diterima</p>
            <p className="text-lg font-semibold">{summary.totalReceived.toLocaleString("id-ID")}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Nilai PO</p>
            <p className="text-lg font-semibold">{formatRupiah(summary.totalAmount)}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Jumlah PO</p>
            <p className="text-lg font-semibold">{summary.totalPurchaseOrders.toLocaleString("id-ID")}</p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border">
          <thead className="bg-muted">
            <tr>
              <th className="p-3 border">Tanggal</th>
              <th className="p-3 border">Nomor PO</th>
              <th className="p-3 border">Supplier</th>
              <th className="p-3 border">Status</th>
              <th className="p-3 border text-right">Dipesan</th>
              <th className="p-3 border text-right">Diterima</th>
              <th className="p-3 border text-right">Harga</th>
              <th className="p-3 border text-right">Total</th>
              <th className="p-3 border"></th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="p-3 border">{new Date(item.createdAt).toLocaleString("id-ID")}</td>
                <td className="p-3 border font-medium">{item.poNumber}</td>
                <td className="p-3 border">{item.supplierName}</td>
                <td className="p-3 border">
                  <Badge variant={item.status === "received" ? "default" : "secondary"}>{statusLabel(item.status)}</Badge>
                </td>
                <td className="p-3 border text-right">
                  {item.quantityOrdered.toLocaleString("id-ID")} {item.unit}
                </td>
                <td className="p-3 border text-right">
                  {item.receivedQuantity.toLocaleString("id-ID")} {item.unit}
                </td>
                <td className="p-3 border text-right">{formatRupiah(item.unitPrice)}</td>
                <td className="p-3 border text-right">{formatRupiah(item.lineTotal)}</td>
                <td className="p-3 border text-right">
                  <Button variant="outline" size="sm" onClick={() => router.push(`/purchase-orders/${item.purchaseOrderId}`)}>
                    Detail
                  </Button>
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
