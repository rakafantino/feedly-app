import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  TrendingUp, 
  Package, 
  ShoppingCart, 
  Wallet, 
  Trash2,
  BarChart3,
  Receipt
} from "lucide-react";

interface ReportCardProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

function ReportCard({ href, icon, title, description }: ReportCardProps) {
  return (
    <Link href={href}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full border-l-4 border-l-transparent hover:border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {icon}
            {title}
          </CardTitle>
          <CardDescription className="text-sm">
            {description}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}

interface ReportCategoryProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function ReportCategory({ title, description, children }: ReportCategoryProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </div>
  );
}

export default function ReportsHubPage() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Laporan</h1>
        <p className="text-muted-foreground mt-1">
          Pusat laporan dan analisis bisnis Anda.
        </p>
      </div>

      {/* Kategori: Keuangan */}
      <ReportCategory
        title="📊 Keuangan"
        description="Laporan terkait pendapatan, pengeluaran, dan profitabilitas."
      >
        <ReportCard
          href="/reports/financial"
          icon={<BarChart3 className="w-5 h-5 text-emerald-500" />}
          title="Ringkasan Keuangan"
          description="Dashboard P&L: Revenue, Expenses, Net Profit."
        />
        <ReportCard
          href="/reports/sales"
          icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
          title="Laporan Penjualan"
          description="Analisis omset, profit, dan margin keuntungan."
        />
        <ReportCard
          href="/reports/purchases"
          icon={<ShoppingCart className="w-5 h-5 text-red-500" />}
          title="Laporan Pembelian"
          description="Rekap pengeluaran Purchase Order ke Supplier."
        />
      </ReportCategory>

      {/* Kategori: Hutang & Piutang */}
      <ReportCategory
        title="💳 Hutang & Piutang"
        description="Monitoring kewajiban pembayaran dan piutang."
      >
        <ReportCard
          href="/reports/debt"
          icon={<Wallet className="w-5 h-5 text-amber-500" />}
          title="Laporan Piutang"
          description="Monitoring hutang pelanggan dan pelunasan."
        />
        <ReportCard
          href="/reports/supplier-debt"
          icon={<Receipt className="w-5 h-5 text-red-500" />}
          title="Laporan Hutang Supplier"
          description="Kewajiban pembayaran ke supplier (PO)."
        />
      </ReportCategory>

      {/* Kategori: Inventaris */}
      <ReportCategory
        title="📦 Inventaris"
        description="Laporan terkait stok dan penyesuaian barang."
      >
        <ReportCard
          href="/reports/inventory"
          icon={<Package className="w-5 h-5 text-blue-500" />}
          title="Laporan Stok (Valuation)"
          description="Nilai aset stok berdasarkan harga beli."
        />
        <ReportCard
          href="/reports/adjustments"
          icon={<Trash2 className="w-5 h-5 text-orange-500" />}
          title="Laporan Penyesuaian"
          description="Barang hilang, rusak, kadaluarsa (waste)."
        />
      </ReportCategory>
    </div>
  );
}