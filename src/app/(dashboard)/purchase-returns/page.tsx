"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, FileText, PackageSearch } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { useStore } from "@/components/providers/store-provider";
import { PurchaseReturnList } from "@/app/(dashboard)/reports/purchase-returns/components/PurchaseReturnList";

interface PurchaseReturnItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product: {
    id: string;
    name: string;
    unit: string;
  };
}

interface PurchaseReturn {
  id: string;
  purchaseOrderId: string;
  totalAmount: number;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  items: PurchaseReturnItem[];
  purchaseOrder: {
    id: string;
    poNumber: string;
  };
  supplier: {
    id: string;
    name: string;
  };
}

interface ReportSummary {
  totalReturns: number;
  totalReturnValue: number;
  totalItems: number;
}

export default function PurchaseReturnsPage() {
  const [loading, setLoading] = useState(false);
  const [returns, setReturns] = useState<PurchaseReturn[]>([]);
  const [summary, setSummary] = useState<ReportSummary>({
    totalReturns: 0,
    totalReturnValue: 0,
    totalItems: 0,
  });

  const { selectedStore } = useStore();
  const storeId = selectedStore?.id;

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/purchase-returns");
      if (!response.ok) throw new Error("Gagal mengambil data retur");

      const data = await response.json();
      setReturns(data.returns || []);

      const totalReturnValue = (data.returns || []).reduce(
        (sum: number, ret: PurchaseReturn) => sum + ret.totalAmount,
        0
      );
      const totalItems = (data.returns || []).reduce(
        (sum: number, ret: PurchaseReturn) => sum + ret.items.length,
        0
      );

      setSummary({
        totalReturns: data.returns?.length || 0,
        totalReturnValue,
        totalItems,
      });
    } catch (error) {
      console.error(error);
      toast.error("Gagal memuat data retur pembelian");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (storeId) {
      fetchReturns();
    }
  }, [fetchReturns, storeId]);

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Retur Pembelian</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Daftar retur pembelian barang dari supplier.
          </p>
        </div>

        <div className="w-full md:w-auto">
          <Button onClick={fetchReturns} disabled={loading} className="w-full md:w-auto">
            {loading ? (
              <Skeleton className="h-10 w-[120px]" />
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="flex overflow-x-auto pb-4 -mx-4 px-4 gap-4 sm:grid sm:grid-cols-3 sm:overflow-visible sm:mx-0 sm:px-0 scrollbar-hide">
        <Card className="min-w-[280px] sm:min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Retur</CardTitle>
            <PackageSearch className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalReturns}</div>
            <p className="text-xs text-muted-foreground">Jumlah transaksi retur</p>
          </CardContent>
        </Card>

        <Card className="min-w-[280px] sm:min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Nilai Retur</CardTitle>
            <RefreshCw className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
                minimumFractionDigits: 0,
              }).format(summary.totalReturnValue)}
            </div>
            <p className="text-xs text-muted-foreground">Total nilai barang yang diretur</p>
          </CardContent>
        </Card>

        <Card className="min-w-[280px] sm:min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Item Retur</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalItems}</div>
            <p className="text-xs text-muted-foreground">Jumlah item yang diretur</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Riwayat Retur Pembelian
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PurchaseReturnList returns={returns} isLoading={loading} />
        </CardContent>
      </Card>
    </div>
  );
}