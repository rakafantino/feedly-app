"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { 
  TrendingUp, 
  DollarSign, 
  Wallet,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,

  Ban
} from "lucide-react";
import { PageSkeleton } from "@/components/skeleton";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";

// Category labels for display (must match expense form categories)
const EXPENSE_CATEGORIES: Record<string, string> = {
  RENT: "Sewa",
  SALARY: "Gaji",
  UTILITIES: "Utilitas",
  SUPPLIES: "Perlengkapan",
  TRANSPORT: "Transportasi",
  MARKETING: "Marketing",
  MAINTENANCE: "Perawatan",
  OTHER: "Lainnya",
};

interface FinancialSummary {
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  totalExpenses: number;
  totalWaste: number;
  totalWriteOffs: number;
  netProfit: number;
  expensesByCategory: Record<string, number>;
  grossMarginPercent: number;
  netMarginPercent: number;
}

interface FinancialData {
  summary: FinancialSummary;
  period: {
    startDate: string;
    endDate: string;
  };
}

const INITIAL_SUMMARY: FinancialSummary = {
    totalRevenue: 0,
    totalCOGS: 0,
    grossProfit: 0,
    totalExpenses: 0,
    totalWaste: 0,
    totalWriteOffs: 0,
    netProfit: 0,
    expensesByCategory: {},
    grossMarginPercent: 0,
    netMarginPercent: 0,
};

export default function FinancialReportPage() {
  const [dateRange, setDateRange] = useState({
    from: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    to: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['financial-report', dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.from,
        endDate: dateRange.to,
      });
      const res = await fetch(`/api/reports/financial-summary?${params}`);
      if (!res.ok) throw new Error("Gagal memuat data");
      return res.json() as Promise<FinancialData>;
    }
  });


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const periodLabel = data?.period 
    ? `${format(new Date(data.period.startDate), "dd MMM", { locale: localeId })} - ${format(new Date(data.period.endDate), "dd MMM yyyy", { locale: localeId })}`
    : format(new Date(), "MMMM yyyy", { locale: localeId });

  if (isLoading) {
    return <PageSkeleton />;
  }

  const summary = data?.summary || INITIAL_SUMMARY;

  return (
    <div className="container mx-auto sm:p-6 space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <Heading
          title="Ringkasan Keuangan"
          description={`Periode: ${periodLabel}`}
        />
        <div className="grid grid-cols-2 gap-3 w-full sm:w-auto">
            <div className="grid gap-1.5 min-w-[130px]">
                <label htmlFor="from" className="text-xs font-medium text-muted-foreground">Dari</label>
                <input
                    type="date"
                    id="from"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={dateRange.from}
                    onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                />
            </div>
            <div className="grid gap-1.5 min-w-[130px]">
                <label htmlFor="to" className="text-xs font-medium text-muted-foreground">Sampai</label>
                <input
                    type="date"
                    id="to"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={dateRange.to}
                    onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                />
            </div>
        </div>
      </div>
      <Separator />

      {/* Summary Cards - Top Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Revenue Card */}
        <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-800">Pendapatan</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(summary.totalRevenue)}
            </div>
            <p className="text-xs text-emerald-700 mt-1">
              Total penjualan periode ini
            </p>
          </CardContent>
        </Card>

        {/* COGS Card */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">HPP (COGS)</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(summary.totalCOGS)}
            </div>
            <p className="text-xs text-blue-700 mt-1">
              Harga Pokok Penjualan
            </p>
          </CardContent>
        </Card>

        {/* Gross Profit Card */}
        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-800">Laba Kotor</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(summary.grossProfit)}
            </div>
            <p className="text-xs text-purple-700 mt-1">
              Margin: {summary.grossMarginPercent.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        {/* Net Profit Card */}
        <Card className={`bg-gradient-to-br ${summary.netProfit >= 0 ? 'from-green-50 to-emerald-50 border-green-200' : 'from-red-50 to-rose-50 border-red-200'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm font-medium ${summary.netProfit >= 0 ? 'text-green-800' : 'text-red-800'}`}>
              Laba Bersih
            </CardTitle>
            {summary.netProfit >= 0 ? (
              <ArrowUpRight className="h-4 w-4 text-green-600" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.netProfit)}
            </div>
            <p className={`text-xs mt-1 ${summary.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              Margin: {summary.netMarginPercent.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detail Cards - Second Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Expenses Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Biaya Operasional</CardTitle>
            <Wallet className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(summary.totalExpenses)}
            </div>
            {Object.keys(summary.expensesByCategory).length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Breakdown:</p>
                {Object.entries(summary.expensesByCategory).map(([category, amount]) => (
                  <div key={category} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {EXPENSE_CATEGORIES[category] || category}
                    </span>
                    <span className="font-medium">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Waste Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Waste / Penyesuaian</CardTitle>
            <Trash2 className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.totalWaste)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Kerugian dari barang rusak/expired
            </p>
          </CardContent>
        </Card>

        {/* Write-Offs Card */}
        {summary.totalWriteOffs > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Piutang Tak Tertagih</CardTitle>
              <Ban className="h-4 w-4 text-rose-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-600">
                {formatCurrency(summary.totalWriteOffs)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Hutang pelanggan yang dihapus (write-off)
              </p>
            </CardContent>
          </Card>
        )}

        {/* P&L Formula Card */}
        <Card className="bg-slate-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Formula P&L</CardTitle>
            <CardDescription className="text-xs">
              Perhitungan Laba Bersih
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-emerald-600">+ Pendapatan</span>
              <span className="font-medium">{formatCurrency(summary.totalRevenue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-600">− HPP</span>
              <span className="font-medium">{formatCurrency(summary.totalCOGS)}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-purple-600">= Laba Kotor</span>
              <span className="font-medium">{formatCurrency(summary.grossProfit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-orange-600">− Biaya Operasional</span>
              <span className="font-medium">{formatCurrency(summary.totalExpenses)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-red-600">− Waste</span>
              <span className="font-medium">{formatCurrency(summary.totalWaste)}</span>
            </div>
            {summary.totalWriteOffs > 0 && (
              <div className="flex justify-between">
                <span className="text-rose-600">− Piutang Tak Tertagih</span>
                <span className="font-medium">{formatCurrency(summary.totalWriteOffs)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold">
              <span className={summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                = Laba Bersih
              </span>
              <span className={summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                {formatCurrency(summary.netProfit)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
