// src/components/dashboard/PriceRecommendationWidget.tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/utils";
import { AlertCircle, ArrowRight, CheckCircle2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface Recommendation {
  id: string;
  name: string;
  currentPrice: number;
  recommendedPrice: number;
  retailMargin: number;
  unit: string;
}

export function PriceRecommendationWidget() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/dashboard/price-recommendations");
      if (!res.ok) throw new Error("Gagal mengambil data");
      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch (error) {
      console.error("Error fetching price recommendations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const handleApply = async (id: string, recommendedPrice: number, name: string) => {
    try {
      setApplyingId(id);
      
      const res = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: recommendedPrice }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal memperbarui harga");
      }

      toast.success(`Harga ${name} berhasil diperbarui menjadi ${formatRupiah(recommendedPrice)}`);
      
      // Remove from list
      setRecommendations(prev => prev.filter(r => r.id !== id));
      
    } catch (error: any) {
      toast.error(error.message || "Terjadi kesalahan");
    } finally {
      setApplyingId(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-500" />
            Rekomendasi Penyesuaian Harga
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-24 flex items-center justify-center text-sm text-muted-foreground">
            Memuat rekomendasi...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-500" />
            Rekomendasi Penyesuaian Harga
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <p className="font-medium text-emerald-700">Semua harga jual sudah optimal</p>
            <p className="text-sm text-muted-foreground mt-1">Margin keuntungan Anda aman.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200 shadow-sm">
      <CardHeader className="pb-3 bg-orange-50/50 rounded-t-xl">
        <CardTitle className="text-lg font-semibold flex items-center gap-2 text-orange-800">
          <AlertCircle className="h-5 w-5 text-orange-500" />
          Rekomendasi Penyesuaian Harga
        </CardTitle>
        <CardDescription className="text-orange-700/80">
          Terdapat {recommendations.length} produk yang harga jualnya di bawah target margin masing-masing.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y max-h-[400px] overflow-y-auto">
          {recommendations.map((item) => (
            <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
              <div className="space-y-1">
                <div className="font-medium">{item.name}</div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-red-600 font-medium">{formatRupiah(item.currentPrice)}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-emerald-600 font-medium">{formatRupiah(item.recommendedPrice)}</span>
                  <span className="text-muted-foreground text-xs">/{item.unit}</span>
                </div>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                className="shrink-0 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                onClick={() => handleApply(item.id, item.recommendedPrice, item.name)}
                disabled={applyingId === item.id}
              >
                {applyingId === item.id ? "Menyimpan..." : "Terapkan Cepat"}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}