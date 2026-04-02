"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, DollarSign, Wallet, Trash2, ArrowUpRight, RefreshCcw, Ban, ChevronDown, ChevronRight } from "lucide-react";
import { PageSkeleton } from "@/components/skeleton";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";

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

const WASTE_TYPES: Record<string, string> = {
  WASTE: "Waste",
  DAMAGED: "Rusak",
  EXPIRED: "Kadaluarsa",
  LOST: "Hilang",
  CORRECTION: "Koreksi",
};

interface FinancialSummary {
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  totalExpenses: number;
  totalWaste: number;
  totalCorrections: number;
  totalWriteOffs: number;
  netProfit: number;
  currentCashBalance: number;
  expensesByCategory: Record<string, number>;
  expensesByCategoryDetail?: Array<{ id: string; category: string; amount: number; description: string | null; date: string }>;
  wasteDetail?: Array<{ id: string; type: string; quantity: number; totalValue: number; reason: string | null; productName: string; date: string }>;
  correctionDetail?: Array<{ id: string; type: string; quantity: number; totalValue: number; reason: string | null; productName: string; date: string }>;
  writeOffDetail?: Array<{ id: string; invoiceNumber: string | null; writtenOffAmount: number; reason: string | null; writtenOffAt: string }>;
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
  totalCorrections: 0,
  totalWriteOffs: 0,
  netProfit: 0,
  currentCashBalance: 0,
  expensesByCategory: {},
  grossMarginPercent: 0,
  netMarginPercent: 0,
};

function ExpandableSection({
  title,
  icon: Icon,
  color,
  totalAmount,
  details,
  formatCurrency,
  renderRow,
}: {
  title: string;
  icon: React.ElementType;
  color: "orange" | "red" | "sky";
  totalAmount: number;
  details: any[];
  formatCurrency: (amount: number) => string;
  renderRow: (item: any, index: number) => React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const colorClasses = {
    orange: { bg: "bg-orange-100", text: "text-orange-600", border: "border-orange-200" },
    red: { bg: "bg-red-100", text: "text-red-600", border: "border-red-200" },
    sky: { bg: "bg-sky-100", text: "text-sky-600", border: "border-sky-200" },
  };
  const colors = colorClasses[color];

  if (details.length === 0) return null;

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="bg-slate-50/50 border-b pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-md ${colors.bg}`}>
              <Icon className={`w-4 h-4 ${colors.text}`} />
            </div>
            <div>
              <CardTitle className="text-base text-slate-800">{title}</CardTitle>
              <p className={`text-sm font-bold ${colors.text}`}>{formatCurrency(totalAmount)}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)} className="gap-2">
            {expanded ? (
              <>
                Sembunyikan <ChevronDown className="w-4 h-4" />
              </>
            ) : (
              <>
                Lihat Detail ({details.length}) <ChevronRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs">Tanggal</TableHead>
                <TableHead className="text-xs">Keterangan</TableHead>
                <TableHead className="text-right text-xs">Jumlah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{details.map((item, index) => renderRow(item, index))}</TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
}

export default function FinancialReportPage() {
  const [dateRange, setDateRange] = useState({
    from: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    to: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["financial-report", dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: dateRange.from,
        endDate: dateRange.to,
      });
      const res = await fetch(`/api/reports/financial-summary?${params}`);
      if (!res.ok) throw new Error("Gagal memuat data");
      return res.json() as Promise<FinancialData>;
    },
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
    <div className="container mx-auto sm:p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <Heading title="Laporan Keuangan" description={`Periode: ${periodLabel}`} />
        <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
          <div className="grid gap-1.5 min-w-[130px]">
            <label htmlFor="from" className="text-xs font-medium text-muted-foreground">
              Dari
            </label>
            <input
              type="date"
              id="from"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={dateRange.from}
              onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5 min-w-[130px]">
            <label htmlFor="to" className="text-xs font-medium text-muted-foreground">
              Sampai
            </label>
            <input
              type="date"
              id="to"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              value={dateRange.to}
              onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
            />
          </div>
        </div>
      </div>
      <Separator />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <CardTitle className="text-lg text-slate-800">Laba Rugi (Profit & Loss)</CardTitle>
              <CardDescription>Rincian perhitungan pendapatan dan beban</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-3">
              <div className="flex justify-between items-center p-3 sm:p-4 bg-emerald-50/50 rounded-lg border border-emerald-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-md hidden sm:block">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="font-medium text-emerald-900 text-sm sm:text-base">Pendapatan</span>
                </div>
                <span className="font-bold text-emerald-700 text-sm sm:text-base">{formatCurrency(summary.totalRevenue)}</span>
              </div>

              <div className="flex justify-between items-center p-3 sm:p-4 bg-blue-50/50 rounded-lg border border-blue-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-md hidden sm:block">
                    <DollarSign className="w-4 h-4 text-blue-600" />
                  </div>
                  <span className="font-medium text-blue-900 text-sm sm:text-base">HPP (Harga Pokok Penjualan)</span>
                </div>
                <span className="font-bold text-blue-700 text-sm sm:text-base">- {formatCurrency(summary.totalCOGS)}</span>
              </div>

              <div className="flex justify-end px-4 py-1">
                <div className="w-1/3 border-b-2 border-slate-200"></div>
              </div>

              <div className="flex justify-between items-center p-3 sm:p-4 bg-purple-50/50 rounded-lg border border-purple-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-md hidden sm:block">
                    <ArrowUpRight className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <span className="font-bold text-purple-900 text-sm sm:text-base block">Laba Kotor</span>
                    <span className="text-xs text-purple-700">Margin: {summary.grossMarginPercent.toFixed(1)}%</span>
                  </div>
                </div>
                <span className="font-bold text-purple-700 text-base sm:text-lg">{formatCurrency(summary.grossProfit)}</span>
              </div>

              <div className="flex justify-between items-center p-3 sm:p-4 bg-orange-50/50 rounded-lg border border-orange-100 mt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-md hidden sm:block">
                    <Wallet className="w-4 h-4 text-orange-600" />
                  </div>
                  <span className="font-medium text-orange-900 text-sm sm:text-base">Biaya Operasional</span>
                </div>
                <span className="font-bold text-orange-700 text-sm sm:text-base">- {formatCurrency(summary.totalExpenses)}</span>
              </div>

              <div className="flex justify-between items-center p-3 sm:p-4 bg-red-50/50 rounded-lg border border-red-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 rounded-md hidden sm:block">
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </div>
                  <span className="font-medium text-red-900 text-sm sm:text-base">Waste / Penyesuaian</span>
                </div>
                <span className="font-bold text-red-700 text-sm sm:text-base">- {formatCurrency(summary.totalWaste)}</span>
              </div>

              <div className="flex justify-end px-4 py-2">
                <div className="w-1/3 border-b-2 border-slate-200"></div>
              </div>

              <div className={`flex justify-between items-center p-4 sm:p-5 rounded-xl border-2 shadow-sm ${summary.netProfit >= 0 ? "bg-green-50 border-green-200" : "bg-rose-50 border-rose-200"}`}>
                <div>
                  <span className={`font-black text-lg sm:text-xl ${summary.netProfit >= 0 ? "text-green-900" : "text-rose-900"}`}>Laba Bersih</span>
                  <span className={`block text-xs sm:text-sm font-medium mt-1 ${summary.netProfit >= 0 ? "text-green-700" : "text-rose-700"}`}>Margin: {summary.netMarginPercent.toFixed(1)}%</span>
                </div>
                <span className={`text-xl sm:text-3xl font-black tracking-tight ${summary.netProfit >= 0 ? "text-green-700" : "text-rose-700"}`}>{formatCurrency(summary.netProfit)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <Card className="bg-slate-900 text-white border-slate-800 shadow-lg overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Wallet className="w-32 h-32" />
            </div>
            <CardContent className="p-6 sm:p-8 relative z-10">
              <div className="space-y-2">
                <p className="text-slate-300 text-sm font-medium uppercase tracking-wider">Saldo Kas Aktual</p>
                <p className="text-3xl sm:text-4xl font-bold tracking-tight">{formatCurrency(summary.currentCashBalance)}</p>
                <p className="text-xs text-slate-400 pt-2">Total uang riil saat ini (All Time)</p>
              </div>
            </CardContent>
          </Card>

          <ExpandableSection
            title="Rincian Biaya Operasional"
            icon={Wallet}
            color="orange"
            totalAmount={summary.totalExpenses}
            details={summary.expensesByCategoryDetail || []}
            formatCurrency={formatCurrency}
            renderRow={(expense) => (
              <TableRow key={expense.id}>
                <TableCell className="text-xs">{format(new Date(expense.date), "dd MMM yyyy", { locale: localeId })}</TableCell>
                <TableCell className="text-xs">
                  <div className="font-medium">{EXPENSE_CATEGORIES[expense.category] || expense.category}</div>
                  {expense.description && <div className="text-muted-foreground text-xs">{expense.description}</div>}
                </TableCell>
                <TableCell className="text-right text-xs font-medium text-orange-600">{formatCurrency(expense.amount)}</TableCell>
              </TableRow>
            )}
          />

          <ExpandableSection
            title="Waste & Penyesuaian Keluar"
            icon={Trash2}
            color="red"
            totalAmount={summary.totalWaste}
            details={summary.wasteDetail || []}
            formatCurrency={formatCurrency}
            renderRow={(item) => (
              <TableRow key={item.id}>
                <TableCell className="text-xs">{format(new Date(item.date), "dd MMM yyyy", { locale: localeId })}</TableCell>
                <TableCell className="text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {WASTE_TYPES[item.type] || item.type}
                    </Badge>
                    {item.reason && <span className="text-muted-foreground">{item.reason}</span>}
                  </div>
                </TableCell>
                <TableCell className="text-right text-xs font-medium text-red-600">- {formatCurrency(Math.abs(item.totalValue))}</TableCell>
              </TableRow>
            )}
          />

          <ExpandableSection
            title="Koreksi Stok Masuk"
            icon={RefreshCcw}
            color="sky"
            totalAmount={summary.totalCorrections}
            details={summary.correctionDetail || []}
            formatCurrency={formatCurrency}
            renderRow={(item) => (
              <TableRow key={item.id}>
                <TableCell className="text-xs">{format(new Date(item.date), "dd MMM yyyy", { locale: localeId })}</TableCell>
                <TableCell className="text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {WASTE_TYPES[item.type] || item.type}
                    </Badge>
                    {item.reason && <span className="text-muted-foreground">{item.reason}</span>}
                  </div>
                </TableCell>
                <TableCell className="text-right text-xs font-medium text-sky-600">+ {formatCurrency(item.totalValue)}</TableCell>
              </TableRow>
            )}
          />

          {summary.totalWriteOffs > 0 && (
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="bg-slate-50/50 border-b pb-4">
                <CardTitle className="text-base text-slate-800">Piutang Tak Tertagih</CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 flex items-center gap-2">
                    <Ban className="w-4 h-4 text-rose-500" />
                    Total Piutang Tak Tertagih
                  </span>
                  <span className="font-bold text-rose-600">-{formatCurrency(summary.totalWriteOffs)}</span>
                </div>
                {(summary.writeOffDetail || []).length > 0 && (
                  <div className="mt-4 space-y-2">
                    {(summary.writeOffDetail || []).map((wo) => (
                      <div key={wo.id} className="text-xs flex justify-between items-center py-1 border-b">
                        <div>
                          <div className="font-medium">{wo.invoiceNumber || "N/A"}</div>
                          {wo.reason && <div className="text-muted-foreground">{wo.reason}</div>}
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-rose-600">{formatCurrency(wo.writtenOffAmount)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
