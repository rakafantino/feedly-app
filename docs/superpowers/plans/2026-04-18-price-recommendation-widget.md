# Price Recommendation Dashboard Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Dashboard Widget that proactively alerts users when a product's selling price falls below the recommended price (based on its updated modal and margins), and allows quick one-click updates.

**Architecture:** We will create an API endpoint `/api/dashboard/price-recommendations` to calculate and serve the recommended prices. We will then create a React component `PriceRecommendationWidget.tsx` to display these alerts and handle the "Quick Apply" action, integrating it into the main Dashboard page.

**Tech Stack:** Next.js (App Router), Prisma ORM, React, Tailwind CSS, Shadcn UI

---

### Task 1: Create Price Recommendations API

**Files:**
- Create: `src/app/api/dashboard/price-recommendations/route.ts`

- [ ] **Step 1: Implement the API endpoint**

Create `src/app/api/dashboard/price-recommendations/route.ts` with the following content:

```typescript
// src/app/api/dashboard/price-recommendations/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

export const GET = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    // Fetch all active products for the store
    const products = await prisma.product.findMany({
      where: { 
        storeId: storeId!,
        isDeleted: false,
        min_selling_price: { not: null }
      },
      select: {
        id: true,
        name: true,
        price: true,
        min_selling_price: true,
        hppCalculationDetails: true,
        unit: true
      }
    });

    const recommendations = [];

    for (const product of products) {
      if (!product.min_selling_price) continue;

      // Extract retail margin from hppCalculationDetails or default to 10%
      let retailMargin = 10;
      if (product.hppCalculationDetails && typeof product.hppCalculationDetails === 'object') {
        const details = product.hppCalculationDetails as any;
        if (details.retailMargin !== undefined) {
          retailMargin = parseFloat(details.retailMargin);
        }
      }

      // Calculate recommended price: min_selling_price + (min_selling_price * retailMargin / 100)
      const rawRecommendedPrice = product.min_selling_price + (product.min_selling_price * (retailMargin / 100));
      
      // Round up to nearest 100
      const recommendedPrice = Math.ceil(rawRecommendedPrice / 100) * 100;

      // If current price is strictly less than recommended price, it needs an update
      if (product.price < recommendedPrice) {
        recommendations.push({
          id: product.id,
          name: product.name,
          currentPrice: product.price,
          recommendedPrice,
          minSellingPrice: product.min_selling_price,
          retailMargin,
          unit: product.unit
        });
      }
    }

    // Sort by largest price difference (most urgent)
    recommendations.sort((a, b) => (b.recommendedPrice - b.currentPrice) - (a.recommendedPrice - a.currentPrice));

    return NextResponse.json({ recommendations });
  } catch (error) {
    console.error("GET /api/dashboard/price-recommendations error:", error);
    return NextResponse.json({ error: "Gagal mengambil rekomendasi harga" }, { status: 500 });
  }
}, { requireStore: true });
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/dashboard/price-recommendations/route.ts
git commit -m "feat: add price recommendations API endpoint"
```

---

### Task 2: Create Price Recommendation Widget Component

**Files:**
- Create: `src/components/dashboard/PriceRecommendationWidget.tsx`

- [ ] **Step 1: Create the Widget Component**

Create `src/components/dashboard/PriceRecommendationWidget.tsx` with the following content:

```tsx
// src/components/dashboard/PriceRecommendationWidget.tsx
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/utils";
import { AlertCircle, ArrowRight, CheckCircle2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

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
          Terdapat {recommendations.length} produk yang harga jualnya di bawah margin target ({recommendations[0]?.retailMargin}%).
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/PriceRecommendationWidget.tsx
git commit -m "feat: create price recommendation widget"
```

---

### Task 3: Integrate Widget into Dashboard

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Import and render the widget**

Edit `src/app/(dashboard)/dashboard/page.tsx`:
Add the import at the top of the file:
```tsx
import { PriceRecommendationWidget } from "@/components/dashboard/PriceRecommendationWidget";
```

Locate the section where widgets are displayed (typically in a grid, likely near `<LowStockAlert />` or the charts).
Add `<PriceRecommendationWidget />` to the layout. For example, if there is a sidebar or a 2-column layout:

Find this section around line ~150-160:
```tsx
        {/* Kolom Kanan: Peringatan & Daftar */}
        <div className="space-y-6">
          <LowStockAlert storeId={activeStore.id} />
          <RecentTransactions storeId={activeStore.id} />
        </div>
```

Update it to include the new widget above or below the `LowStockAlert`:
```tsx
        {/* Kolom Kanan: Peringatan & Daftar */}
        <div className="space-y-6">
          <PriceRecommendationWidget />
          <LowStockAlert storeId={activeStore.id} />
          <RecentTransactions storeId={activeStore.id} />
        </div>
```

- [ ] **Step 2: Run build to verify types**

Run: `npm run build`
Expected: Successful build.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: integrate price recommendation widget into dashboard"
```
