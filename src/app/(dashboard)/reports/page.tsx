import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, Package, ShoppingCart, Wallet } from "lucide-react";

export default function ReportsHubPage() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Laporan</h1>
        <p className="text-muted-foreground mt-1">
          Pusat laporan dan analisis bisnis Anda.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/reports/sales">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                Laporan Penjualan
              </CardTitle>
              <CardDescription>
                Analisis omset, profit, dan margin keuntungan.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        
        <Link href="/reports/inventory">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-500" />
                Laporan Stok (Valuation)
              </CardTitle>
              <CardDescription>
                Analisis nilai aset stok barang berdasarkan harga beli.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        
        <Link href="/reports/purchases">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-red-500" />
                Laporan Pembelian
              </CardTitle>
              <CardDescription>
                Rekap pengeluaran Purchase Order ke Supplier.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        
        <Link href="/reports/debt">
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-amber-500" />
                Laporan Piutang
              </CardTitle>
              <CardDescription>
                Monitoring hutang pelanggan dan pelunasan.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}