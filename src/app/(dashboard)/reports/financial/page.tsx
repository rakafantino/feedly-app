"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, DollarSign, Wallet, Trash2, RefreshCcw, Ban, ChevronDown, ChevronRight } from "lucide-react";
import { PageSkeleton } from "@/components/skeleton";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { CAPITAL_CATEGORY_META, CapitalCategory } from "@/lib/capital-classification";

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
  cashFlow?: {
    salesCashIn: number;
    debtPaymentCashIn: number;
    initialCapitalCashIn: number;
    additionalCapitalCashIn: number;
    capitalInjection: number;
    purchaseOrderCashOut: number;
    expenseCashOut: number;
    capitalWithdrawal: number;
    totalCashIn: number;
    totalCashOut: number;
    netCashFlow: number;
  };
  equity?: {
    initialCapital: number;
    additionalCapital: number;
    totalCapitalInjections: number;
    ownerWithdrawals: number;
    periodNetProfit: number;
    retainedEarnings: number;
    endingEquityEstimate: number;
  };
  capitalTransactionDetail?: Array<{ id: string; type: string; category: string; amount: number; notes: string | null; date: string }>;
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
  cashFlow: {
    salesCashIn: 0,
    debtPaymentCashIn: 0,
    initialCapitalCashIn: 0,
    additionalCapitalCashIn: 0,
    capitalInjection: 0,
    purchaseOrderCashOut: 0,
    expenseCashOut: 0,
    capitalWithdrawal: 0,
    totalCashIn: 0,
    totalCashOut: 0,
    netCashFlow: 0,
  },
  equity: {
    initialCapital: 0,
    additionalCapital: 0,
    totalCapitalInjections: 0,
    ownerWithdrawals: 0,
    periodNetProfit: 0,
    retainedEarnings: 0,
    endingEquityEstimate: 0,
  },
  capitalTransactionDetail: [],
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

function StatementRow({
  label,
  value,
  tone = "neutral",
  prefix = "",
  strong = false,
  formatCurrency,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "positive" | "negative";
  prefix?: string;
  strong?: boolean;
  formatCurrency: (amount: number) => string;
}) {
  const toneClass = {
    neutral: "text-slate-900",
    positive: "text-emerald-700",
    negative: "text-rose-700",
  }[tone];

  return (
    <div className={`flex items-center justify-between gap-4 py-2 ${strong ? "text-base" : "text-sm"}`}>
      <span className={strong ? "font-bold text-slate-900" : "text-slate-600"}>{label}</span>
      <span className={`${strong ? "font-black" : "font-semibold"} ${toneClass} text-right whitespace-nowrap`}>
        {prefix}
        {formatCurrency(Math.abs(value))}
      </span>
    </div>
  );
}

export default function FinancialReportPage() {
  const [dateRange, setDateRange] = useState({
    from: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    to: format(endOfMonth(new Date()), "yyyy-MM-dd"),
  });

  const setQuickFilter = (type: 'today' | 'this_month' | 'all_time') => {
    const today = new Date();
    const to = format(today, "yyyy-MM-dd");
    let from = "";

    if (type === 'today') {
      from = to;
    } else if (type === 'this_month') {
      from = format(startOfMonth(today), "yyyy-MM-dd");
    } else if (type === 'all_time') {
      from = "2020-01-01"; // Arbitrary old date
    }

    setDateRange({ from, to });
  };

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
  const cashFlow = summary.cashFlow || INITIAL_SUMMARY.cashFlow!;
  const equity = summary.equity || INITIAL_SUMMARY.equity!;

  return (
    <div className="container mx-auto sm:p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <Heading title="Laporan Keuangan" description={`Periode laba rugi: ${periodLabel}`} />
        <div className="flex flex-col gap-3 w-full md:w-auto">
          <div className="flex flex-wrap gap-2 justify-start md:justify-end">
            <Button variant="outline" size="sm" onClick={() => setQuickFilter('today')}>Hari Ini</Button>
            <Button variant="outline" size="sm" onClick={() => setQuickFilter('this_month')}>Bulan Ini</Button>
            <Button variant="outline" size="sm" onClick={() => setQuickFilter('all_time')}>Semua Waktu</Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
      </div>
      <Separator />

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Laba rugi</p>
            <p className={`mt-1 text-2xl font-black tracking-tight ${summary.netProfit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {formatCurrency(summary.netProfit)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Mengikuti filter tanggal di atas.</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Kas aktual</p>
            <p className="mt-1 text-2xl font-black tracking-tight text-slate-950">{formatCurrency(summary.currentCashBalance)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Selalu dihitung dari seluruh histori.</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Estimasi modal</p>
            <p className="mt-1 text-2xl font-black tracking-tight text-slate-950">{formatCurrency(equity.endingEquityEstimate)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Selalu dihitung dari seluruh histori.</p>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b bg-white pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg text-slate-900">Laba Rugi</CardTitle>
                <CardDescription>Periode: {periodLabel}</CardDescription>
              </div>
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <StatementRow label="Pendapatan" value={summary.totalRevenue} tone="positive" prefix="+ " formatCurrency={formatCurrency} />
            <StatementRow label="HPP" value={summary.totalCOGS} tone="negative" prefix="- " formatCurrency={formatCurrency} />
            <Separator className="my-2" />
            <StatementRow label="Laba kotor" value={summary.grossProfit} tone={summary.grossProfit >= 0 ? "positive" : "negative"} strong formatCurrency={formatCurrency} />
            <p className="mb-3 text-xs text-muted-foreground">Margin kotor: {summary.grossMarginPercent.toFixed(1)}%</p>
            <StatementRow label="Biaya operasional" value={summary.totalExpenses} tone="negative" prefix="- " formatCurrency={formatCurrency} />
            <StatementRow label="Waste / penyesuaian keluar" value={summary.totalWaste} tone="negative" prefix="- " formatCurrency={formatCurrency} />
            {summary.totalCorrections > 0 && <StatementRow label="Koreksi stok masuk" value={summary.totalCorrections} tone="positive" prefix="+ " formatCurrency={formatCurrency} />}
            {summary.totalWriteOffs > 0 && <StatementRow label="Piutang tak tertagih" value={summary.totalWriteOffs} tone="negative" prefix="- " formatCurrency={formatCurrency} />}
            <Separator className="my-3" />
            <StatementRow label="Laba bersih" value={summary.netProfit} tone={summary.netProfit >= 0 ? "positive" : "negative"} strong formatCurrency={formatCurrency} />
            <p className="text-xs text-muted-foreground">Margin bersih: {summary.netMarginPercent.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b bg-white pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg text-slate-900">Arus Kas Aktual</CardTitle>
                <CardDescription>Semua waktu</CardDescription>
              </div>
              <Wallet className="h-5 w-5 text-slate-700" />
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <StatementRow label="Penjualan diterima" value={cashFlow.salesCashIn} tone="positive" prefix="+ " formatCurrency={formatCurrency} />
            <StatementRow label="Pelunasan piutang" value={cashFlow.debtPaymentCashIn} tone="positive" prefix="+ " formatCurrency={formatCurrency} />
            <StatementRow label="Modal awal" value={cashFlow.initialCapitalCashIn} tone="positive" prefix="+ " formatCurrency={formatCurrency} />
            <StatementRow label="Tambahan/penyesuaian modal" value={cashFlow.additionalCapitalCashIn} tone="positive" prefix="+ " formatCurrency={formatCurrency} />
            <Separator className="my-2" />
            <StatementRow label="Pembayaran PO" value={cashFlow.purchaseOrderCashOut} tone="negative" prefix="- " formatCurrency={formatCurrency} />
            <StatementRow label="Biaya operasional" value={cashFlow.expenseCashOut} tone="negative" prefix="- " formatCurrency={formatCurrency} />
            <StatementRow label="Prive/penyesuaian keluar" value={cashFlow.capitalWithdrawal} tone="negative" prefix="- " formatCurrency={formatCurrency} />
            <Separator className="my-3" />
            <StatementRow label="Saldo kas formula" value={cashFlow.netCashFlow} tone="neutral" strong formatCurrency={formatCurrency} />
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b bg-white pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg text-slate-900">Perubahan Modal</CardTitle>
                <CardDescription>Semua waktu</CardDescription>
              </div>
              <DollarSign className="h-5 w-5 text-sky-700" />
            </div>
          </CardHeader>
          <CardContent className="p-5">
            <StatementRow label="Modal awal" value={equity.initialCapital} tone="neutral" formatCurrency={formatCurrency} />
            <StatementRow label="Tambahan/penyesuaian modal" value={equity.additionalCapital} tone="positive" prefix="+ " formatCurrency={formatCurrency} />
            <StatementRow label="Akumulasi laba/rugi" value={equity.retainedEarnings} tone={equity.retainedEarnings >= 0 ? "positive" : "negative"} prefix={equity.retainedEarnings >= 0 ? "+ " : "- "} formatCurrency={formatCurrency} />
            <StatementRow label="Prive/penyesuaian keluar" value={equity.ownerWithdrawals} tone="negative" prefix="- " formatCurrency={formatCurrency} />
            <Separator className="my-3" />
            <StatementRow label="Estimasi modal akhir" value={equity.endingEquityEstimate} tone="neutral" strong formatCurrency={formatCurrency} />
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
          title="Rincian Modal & Prive"
          icon={Wallet}
          color="sky"
          totalAmount={equity.totalCapitalInjections - equity.ownerWithdrawals}
          details={summary.capitalTransactionDetail || []}
          formatCurrency={formatCurrency}
          renderRow={(item) => {
            const category = item.category as CapitalCategory;
            const label = CAPITAL_CATEGORY_META[category]?.label || (item.type === "INJECTION" ? "Tambah Modal" : "Prive");

            return (
              <TableRow key={item.id}>
                <TableCell className="text-xs">{format(new Date(item.date), "dd MMM yyyy", { locale: localeId })}</TableCell>
                <TableCell className="text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant={item.type === "INJECTION" ? "default" : "secondary"} className="text-xs">
                      {label}
                    </Badge>
                    {item.notes && <span className="text-muted-foreground">{item.notes}</span>}
                  </div>
                </TableCell>
                <TableCell className={`text-right text-xs font-medium ${item.type === "INJECTION" ? "text-emerald-600" : "text-rose-600"}`}>
                  {item.type === "INJECTION" ? "+ " : "- "}
                  {formatCurrency(item.amount)}
                </TableCell>
              </TableRow>
            );
          }}
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
          <Card className="shadow-sm border-slate-200 xl:col-span-2">
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
      </section>
    </div>
  );
}
