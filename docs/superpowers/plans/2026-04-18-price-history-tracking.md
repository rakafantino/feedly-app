# Price History Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track and record changes to both Purchase Prices and Selling Prices automatically across the system to help with margin analysis and auditing.

**Architecture:** We will modify the Prisma schema to add `priceType` to the existing `PriceHistory` model. Then, we update the Product API (`PUT /api/products/[id]`) and Purchase Order API (`PUT /api/purchase-orders/[id]`) to create `PriceHistory` records when prices change. Finally, we'll build a UI tab in the Product Details and a Global Reports page to display this data.

**Tech Stack:** Next.js (App Router), Prisma ORM, PostgreSQL, React, Tailwind CSS

---

### Task 1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Modify PriceHistory model**

Edit `prisma/schema.prisma` and replace the existing `PriceHistory` model with the updated one:

```prisma
model PriceHistory {
  id               String   @id @default(uuid())
  productId        String   @map("product_id")
  storeId          String   @map("store_id")
  priceType        String   @map("price_type") // 'PURCHASE' or 'SELLING'
  oldPrice         Float    @map("old_price")
  newPrice         Float    @map("new_price")
  changeAmount     Float    @map("change_amount")
  changePercentage Float    @map("change_percentage")
  source           String   // 'PURCHASE_ORDER', 'MANUAL_EDIT', 'SYSTEM_CASCADE'
  referenceId      String?  @map("reference_id")
  createdAt        DateTime @default(now()) @map("created_at")

  product Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  store   Store   @relation(fields: [storeId], references: [id], onDelete: Cascade)

  @@index([productId])
  @@index([storeId])
  @@index([createdAt])
  @@map("price_histories")
}
```

- [ ] **Step 2: Apply Database Schema Push**

Run: `npx prisma db push`
Expected: Database in sync with Prisma schema.

- [ ] **Step 3: Generate Prisma Client**

Run: `npx prisma generate`
Expected: Prisma Client generated successfully.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: update PriceHistory model in prisma schema"
```

---

### Task 2: Create Utility for Calculating Price Change

**Files:**
- Create: `src/lib/price-history.ts`

- [ ] **Step 1: Write utility implementation**

```typescript
// src/lib/price-history.ts

export function calculatePriceChange(oldPrice: number | null | undefined, newPrice: number) {
  const safeOldPrice = oldPrice || 0;
  
  if (safeOldPrice === newPrice) {
    return { changeAmount: 0, changePercentage: 0 };
  }

  const changeAmount = newPrice - safeOldPrice;
  
  let changePercentage = 0;
  if (safeOldPrice === 0) {
    changePercentage = newPrice > 0 ? 100 : 0;
  } else {
    changePercentage = (changeAmount / safeOldPrice) * 100;
  }

  return { 
    changeAmount, 
    changePercentage: Number(changePercentage.toFixed(2)) 
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/price-history.ts
git commit -m "feat: add utility for price change calculations"
```

---

### Task 3: Update Purchase Order API to Record History

**Files:**
- Modify: `src/app/api/purchase-orders/[id]/route.ts`

- [ ] **Step 1: Update PUT handler for PO receiving**

In `src/app/api/purchase-orders/[id]/route.ts`, import `calculatePriceChange`:
```typescript
import { calculatePriceChange } from "@/lib/price-history";
```

Find the logic where `purchase_price` is updated in `tx.product.update` inside the loop `for (const receivedItem of receiveData.items)`. First, query the current product to get the old purchase price, then create history.

Update the block around line 166:
```typescript
                // Fetch existing product to get old purchase_price
                const existingProd = await tx.product.findUnique({ where: { id: currentItem.productId } });
                const newPurchasePrice = typeof currentItem.price === "string" ? parseFloat(currentItem.price) : currentItem.price;
                
                const updatedProduct = await tx.product.update({
                  where: { id: currentItem.productId },
                  data: {
                    purchase_price: newPurchasePrice,
                  },
                });

                // Create Price History if purchase_price changed
                if (existingProd && existingProd.purchase_price !== newPurchasePrice) {
                  const change = calculatePriceChange(existingProd.purchase_price, newPurchasePrice);
                  await tx.priceHistory.create({
                    data: {
                      productId: currentItem.productId,
                      storeId: storeId!,
                      priceType: 'PURCHASE',
                      oldPrice: existingProd.purchase_price || 0,
                      newPrice: newPurchasePrice,
                      changeAmount: change.changeAmount,
                      changePercentage: change.changePercentage,
                      source: 'PURCHASE_ORDER',
                      referenceId: purchaseOrderId,
                    }
                  });
                }

                // Cascade update to retail (child) product if it exists
                if (updatedProduct.conversionTargetId && updatedProduct.conversionRate && updatedProduct.purchase_price) {
                  const newChildPurchasePrice = Math.round(updatedProduct.purchase_price / updatedProduct.conversionRate);
                  
                  // Get child to check old price
                  const existingChild = await tx.product.findUnique({
                    where: { id: updatedProduct.conversionTargetId }
                  });

                  await tx.product.updateMany({
                    where: {
                      id: updatedProduct.conversionTargetId,
                      storeId: storeId!,
                    },
                    data: {
                      purchase_price: newChildPurchasePrice,
                      hpp_price: newChildPurchasePrice,
                    },
                  });

                  // Create Price History for Child if changed
                  if (existingChild && existingChild.purchase_price !== newChildPurchasePrice) {
                     const childChange = calculatePriceChange(existingChild.purchase_price, newChildPurchasePrice);
                     await tx.priceHistory.create({
                      data: {
                        productId: updatedProduct.conversionTargetId,
                        storeId: storeId!,
                        priceType: 'PURCHASE',
                        oldPrice: existingChild.purchase_price || 0,
                        newPrice: newChildPurchasePrice,
                        changeAmount: childChange.changeAmount,
                        changePercentage: childChange.changePercentage,
                        source: 'SYSTEM_CASCADE',
                        referenceId: purchaseOrderId,
                      }
                    });
                  }
                }
```

- [ ] **Step 2: Build and verify no typescript errors**

Run: `npx tsc --noEmit`
Expected: Passes without errors related to `PriceHistory`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/purchase-orders/[id]/route.ts
git commit -m "feat: record purchase price history on PO receive"
```

---

### Task 4: Update Product API to Record Manual Edits

**Files:**
- Modify: `src/app/api/products/[id]/route.ts`

- [ ] **Step 1: Import calculatePriceChange utility**

```typescript
import { calculatePriceChange } from "@/lib/price-history";
```

- [ ] **Step 2: Add PriceHistory creations in PUT handler**

Right after `const updatedProduct = await prisma.product.update({...})` inside `PUT` (around line 321):

```typescript
      // Track SELLING Price History
      if (mb.price !== undefined && existingProduct.price !== mb.price) {
        const change = calculatePriceChange(existingProduct.price, mb.price);
        await prisma.priceHistory.create({
          data: {
            productId: id,
            storeId: storeId!,
            priceType: 'SELLING',
            oldPrice: existingProduct.price,
            newPrice: mb.price,
            changeAmount: change.changeAmount,
            changePercentage: change.changePercentage,
            source: 'MANUAL_EDIT',
          }
        });
      }

      // Track PURCHASE Price History
      if (mb.purchase_price !== undefined && existingProduct.purchase_price !== mb.purchase_price) {
        const change = calculatePriceChange(existingProduct.purchase_price, mb.purchase_price);
        await prisma.priceHistory.create({
          data: {
            productId: id,
            storeId: storeId!,
            priceType: 'PURCHASE',
            oldPrice: existingProduct.purchase_price || 0,
            newPrice: mb.purchase_price,
            changeAmount: change.changeAmount,
            changePercentage: change.changePercentage,
            source: 'MANUAL_EDIT',
          }
        });
      }
```

Also, update the Cascade Update section (around line 388) inside the `if (hasUpdates)` block:
```typescript
        if (hasUpdates) {
          // fetch old child
          const oldChild = await prisma.product.findUnique({
            where: { id: updatedProduct.conversionTargetId }
          });

          await prisma.product.updateMany({
            where: {
              id: updatedProduct.conversionTargetId,
              storeId: storeId!,
            },
            data: childUpdates,
          });

          if (childUpdates.purchase_price !== undefined && oldChild && oldChild.purchase_price !== childUpdates.purchase_price) {
            const childChange = calculatePriceChange(oldChild.purchase_price, childUpdates.purchase_price);
            await prisma.priceHistory.create({
              data: {
                productId: updatedProduct.conversionTargetId,
                storeId: storeId!,
                priceType: 'PURCHASE',
                oldPrice: oldChild.purchase_price || 0,
                newPrice: childUpdates.purchase_price,
                changeAmount: childChange.changeAmount,
                changePercentage: childChange.changePercentage,
                source: 'SYSTEM_CASCADE',
              }
            });
          }
        }
```

- [ ] **Step 3: Run typescript check**

Run: `npx tsc --noEmit`
Expected: Pass

- [ ] **Step 4: Commit**

```bash
git add src/app/api/products/[id]/route.ts
git commit -m "feat: record price history on manual product edit"
```

---

### Task 5: Add API to Fetch Price History

**Files:**
- Create: `src/app/api/products/[id]/price-history/route.ts`
- Create: `src/app/api/reports/price-movements/route.ts`

- [ ] **Step 1: Product Specific History API**

```typescript
// src/app/api/products/[id]/price-history/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

export const GET = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    const pathname = request.nextUrl.pathname;
    // Extract ID from /api/products/[id]/price-history
    const segments = pathname.split("/");
    const id = segments[segments.length - 2];

    const history = await prisma.priceHistory.findMany({
      where: { productId: id, storeId: storeId! },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ history });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch price history" }, { status: 500 });
  }
}, { requireStore: true });
```

- [ ] **Step 2: Global Price History Report API**

```typescript
// src/app/api/reports/price-movements/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

export const GET = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const priceType = searchParams.get('priceType');

    const where: any = { storeId: storeId! };
    if (priceType && priceType !== 'ALL') {
      where.priceType = priceType;
    }

    const history = await prisma.priceHistory.findMany({
      where,
      include: {
        product: { select: { name: true, product_code: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return NextResponse.json({ history });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch price movements" }, { status: 500 });
  }
}, { requireStore: true });
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/products/*/route.ts src/app/api/reports/price-movements/route.ts
git commit -m "feat: add APIs for price history retrieval"
```

---

### Task 6: Create Product Detail "Riwayat Harga" UI Component

**Files:**
- Create: `src/components/products/PriceHistoryTab.tsx`
- Modify: `src/app/dashboard/products/[id]/page.tsx` (or where product tabs exist)

- [ ] **Step 1: Create PriceHistoryTab component**

```tsx
// src/components/products/PriceHistoryTab.tsx
"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function PriceHistoryTab({ productId }: { productId: string }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/products/${productId}/price-history`)
      .then(res => res.json())
      .then(data => {
        if (data.history) setHistory(data.history);
        setLoading(false);
      });
  }, [productId]);

  if (loading) return <div>Loading history...</div>;
  if (history.length === 0) return <div>Belum ada riwayat perubahan harga.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left border">
        <thead className="bg-muted">
          <tr>
            <th className="p-3 border">Tanggal</th>
            <th className="p-3 border">Tipe</th>
            <th className="p-3 border">Harga Lama</th>
            <th className="p-3 border">Harga Baru</th>
            <th className="p-3 border">Selisih</th>
            <th className="p-3 border">Sumber</th>
          </tr>
        </thead>
        <tbody>
          {history.map(item => {
            const isIncrease = item.changeAmount > 0;
            const textColor = isIncrease ? "text-red-600" : "text-green-600";
            return (
              <tr key={item.id} className="border-b">
                <td className="p-3 border">{new Date(item.createdAt).toLocaleString()}</td>
                <td className="p-3 border">
                  <Badge variant={item.priceType === 'PURCHASE' ? 'outline' : 'default'}>
                    {item.priceType === 'PURCHASE' ? 'Beli (Modal)' : 'Jual'}
                  </Badge>
                </td>
                <td className="p-3 border">{formatCurrency(item.oldPrice)}</td>
                <td className="p-3 border">{formatCurrency(item.newPrice)}</td>
                <td className={`p-3 border font-medium ${textColor}`}>
                  {isIncrease ? "+" : ""}{formatCurrency(item.changeAmount)} ({isIncrease ? "+" : ""}{item.changePercentage}%)
                </td>
                <td className="p-3 border">{item.source}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Integrate into Product Detail/Edit page**

*Note: Since the exact structure of the product details page is unknown, instruct the subagent to locate the product forms/tabs (usually `src/app/dashboard/products/[id]/edit/page.tsx` or similar) and append `<PriceHistoryTab productId={id} />` at the bottom or inside an existing Tab container.*

- [ ] **Step 3: Commit**

```bash
git add src/components/products/PriceHistoryTab.tsx
git commit -m "feat: add PriceHistoryTab component for product details"
```

---

### Task 7: Create Global Price Movements Report Page

**Files:**
- Create: `src/app/dashboard/reports/price-movements/page.tsx`

- [ ] **Step 1: Create the Report Page**

```tsx
// src/app/dashboard/reports/price-movements/page.tsx
"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function PriceMovementsPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("ALL");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/price-movements?priceType=${typeFilter}&limit=100`)
      .then(res => res.json())
      .then(data => {
        if (data.history) setHistory(data.history);
        setLoading(false);
      });
  }, [typeFilter]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Laporan Pergerakan Harga</h1>
      
      <div className="mb-4">
        <label className="mr-2 font-medium">Filter Tipe:</label>
        <select 
          className="border rounded p-2"
          value={typeFilter} 
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="ALL">Semua</option>
          <option value="PURCHASE">Harga Beli (Modal)</option>
          <option value="SELLING">Harga Jual</option>
        </select>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="overflow-x-auto bg-white rounded shadow">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 border-b">Waktu</th>
                <th className="p-3 border-b">Produk</th>
                <th className="p-3 border-b">Tipe</th>
                <th className="p-3 border-b">Harga Lama</th>
                <th className="p-3 border-b">Harga Baru</th>
                <th className="p-3 border-b">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center">Tidak ada pergerakan harga.</td></tr>
              ) : (
                history.map(item => {
                  const isIncrease = item.changeAmount > 0;
                  const textColor = isIncrease ? "text-red-600" : "text-green-600";
                  return (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{new Date(item.createdAt).toLocaleString()}</td>
                      <td className="p-3 font-medium">{item.product.name}</td>
                      <td className="p-3">
                        <Badge variant={item.priceType === 'PURCHASE' ? 'outline' : 'default'}>
                          {item.priceType === 'PURCHASE' ? 'Beli' : 'Jual'}
                        </Badge>
                      </td>
                      <td className="p-3">{formatCurrency(item.oldPrice)}</td>
                      <td className="p-3">{formatCurrency(item.newPrice)}</td>
                      <td className={`p-3 font-medium ${textColor}`}>
                        {isIncrease ? "+" : ""}{formatCurrency(item.changeAmount)} ({isIncrease ? "+" : ""}{item.changePercentage}%)
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/dashboard/reports/price-movements/page.tsx
git commit -m "feat: add global price movements report page"
```
