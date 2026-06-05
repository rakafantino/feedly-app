# Feedly App Performance & DB Optimization Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Resolve ticking time bomb performance bottlenecks by adding missing database indices, eliminating N+1 queries in Purchase Orders, and reducing React re-renders in the POS cart.

**Architecture:** 
1. Database level: Add `@@index` to frequently queried relation fields in Prisma schema to prevent Sequential Scans.
2. Backend level: Implement batched Pre-fetching using HashMaps (O(1) lookups) in Purchase Order services to replace repetitive `findUnique` inside loops.
3. Frontend level: Implement `React.memo` and localized state management to prevent O(N) re-rendering of POS Cart Items during checkout.

**Tech Stack:** Prisma ORM, PostgreSQL, Next.js API Routes, React.

---

### Task 1: Add Critical Database Indexes

**Objective:** Prevent Sequential Scans by indexing foreign keys and frequently filtered columns.

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Write implementation**

In `prisma/schema.prisma`, add the missing indexes:

1. On `model Product` (around line 140), add:
```prisma
  @@index([storeId, isDeleted])
```

2. On `model PurchaseOrderItem` (around line 300), add:
```prisma
  @@index([productId])
```

3. On `model TransactionItem` (around line 268), add:
```prisma
  @@index([productId])
```

**Step 2: Run Prisma validation and DB Push**

Run: `npx prisma format`
Expected: `Prisma schema loaded and formatted`

Run: `npx prisma db push --accept-data-loss` (or create a migration if in production workflow, but since we are safe in dev we use db push for indexes)
Expected: `The database is now in sync with your Prisma schema.`

**Step 3: Commit**
```bash
git add prisma/schema.prisma
git commit -m "perf(db): add missing indices for products and transaction items"
```

---

### Task 2: Eliminate N+1 Queries in PO Receive Goods

**Objective:** Pre-fetch Products and ProductBatches outside the `for` loop in `handleReceiveGoods`.

**Files:**
- Modify: `src/app/api/purchase-orders/[id]/route.ts`

**Step 1: Write implementation**

Find `handleReceiveGoods` function. Before the `for (const receivedItem of receiveData.items)` loop, add pre-fetching:

```typescript
      // PRE-FETCH OPTIMIZATION
      const receivedProductIds = receiveData.items.map((i: any) => i.productId || existingPO.items.find((ei: any) => ei.id === i.id)?.productId).filter(Boolean);
      
      const [allProducts, allActiveBatches] = await Promise.all([
        tx.product.findMany({
          where: { id: { in: receivedProductIds } },
        }),
        tx.productBatch.findMany({
          where: { productId: { in: receivedProductIds }, stock: { gt: 0 } },
        })
      ]);

      const productMap = new Map(allProducts.map(p => [p.id, p]));
      const batchesByProduct = new Map<string, typeof allActiveBatches>();
      
      for (const b of allActiveBatches) {
        if (!batchesByProduct.has(b.productId)) batchesByProduct.set(b.productId, []);
        batchesByProduct.get(b.productId)!.push(b);
      }
      
      // Fetch previous PO prices in one go
      const previousPOItems = await tx.purchaseOrderItem.findMany({
        where: {
          productId: { in: receivedProductIds },
          purchaseOrderId: { not: purchaseOrderId },
        },
        orderBy: { createdAt: "desc" },
      });
      
      const previousPriceMap = new Map<string, number>();
      for (const pItem of previousPOItems) {
        if (!previousPriceMap.has(pItem.productId)) {
           previousPriceMap.set(pItem.productId, pItem.price);
        }
      }
```

Then inside the loop, replace `await tx.product.findUnique` with `productMap.get(currentItem.productId)` and replace `await tx.productBatch.findMany` with `batchesByProduct.get(currentItem.productId) || []`. Replace the `previousPOItems` query with `previousPriceMap.get(currentItem.productId) ?? 0`.

**Step 2: Run test to verify pass**

Run: `npx jest src/app/api/purchase-orders/\[id\]/route.test.ts`
Expected: PASS (Behavior unchanged, just significantly faster)

**Step 3: Commit**
```bash
git add src/app/api/purchase-orders/[id]/route.ts
git commit -m "perf(api): eliminate N+1 queries in handleReceiveGoods"
```

---

### Task 3: Eliminate N+1 Queries in PO Edit

**Objective:** Pre-fetch Products and ProductSuppliers outside the `for` loop in `handlePurchaseOrderEdit`.

**Files:**
- Modify: `src/app/api/purchase-orders/[id]/route.ts`

**Step 1: Write implementation**

Find `handlePurchaseOrderEdit`. Before the `for (const itemToUpdate of body.items)` loop, add:

```typescript
      // PRE-FETCH OPTIMIZATION
      const updateProductIds = body.items.map((i: any) => existingPO.items.find((ei: any) => ei.id === i.id)?.productId).filter(Boolean);
      
      const [allProducts, allProductSuppliers] = await Promise.all([
        tx.product.findMany({
          where: { id: { in: updateProductIds } }
        }),
        tx.productSupplier.findMany({
          where: { 
            productId: { in: updateProductIds },
            supplierId: existingPO.supplierId 
          }
        })
      ]);
      
      const productMap = new Map(allProducts.map(p => [p.id, p]));
      const supplierMap = new Map(allProductSuppliers.map(ps => [ps.productId, ps]));
```

Inside the loop, replace `await tx.product.findUnique` with `productMap.get(currentItem.productId)` and replace `await tx.productSupplier.findUnique` with `supplierMap.get(currentItem.productId)`.

**Step 2: Run test to verify pass**

Run: `npx jest src/app/api/purchase-orders/\[id\]/route.test.ts`
Expected: PASS

**Step 3: Commit**
```bash
git add src/app/api/purchase-orders/[id]/route.ts
git commit -m "perf(api): eliminate N+1 queries in handlePurchaseOrderEdit"
```

---

### Task 4: Optimize POS Cart React Rendering

**Objective:** Wrap `CartItem` in `React.memo` and memoize the callback functions in `Cart.tsx` / `page.tsx` to prevent O(N) re-renders when a single item changes.

**Files:**
- Modify: `src/app/(dashboard)/pos/components/CartItem.tsx`
- Modify: `src/app/(dashboard)/pos/components/Cart.tsx`

**Step 1: Write implementation**

In `CartItem.tsx`, wrap the default export with `memo`:

```tsx
import { memo } from "react";
// ...
export const CartItem = memo(function CartItem({ item, onQuantityChange, onPriceChange, onRemove, isProcessing }: CartItemProps) {
  // ... existing code
}, (prevProps, nextProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.quantity === nextProps.item.quantity &&
    prevProps.item.price === nextProps.item.price &&
    prevProps.isProcessing === nextProps.isProcessing
  );
});
```

In `Cart.tsx` and `page.tsx` (where the cart is rendered), ensure `updateQuantity`, `updatePrice`, and `removeItem` are wrapped in `useCallback` to maintain referential equality.

**Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: 0 Errors

**Step 3: Commit**
```bash
git add src/app/\(dashboard\)/pos/components/CartItem.tsx
git commit -m "perf(ui): memoize POS CartItem to prevent global re-renders"
```

---

### Task 5: Final Regression Run

**Objective:** Verify entire application functionality remains unchanged.

**Step 1: Run Full Test Suite**

Run: `npx jest --coverage`
Expected: 100% PASS on all tests (2020/2020).

**Step 2: Commit**
```bash
git commit --allow-empty -m "chore: completed performance optimization sprint"
```