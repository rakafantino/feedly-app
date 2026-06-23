import {
  extractNumericPrice,
  calculateWeightedAverage,
} from "./receive-goods.core";
import { calculatePriceChange } from "@/lib/price-history";

/**
 * Pure core: compute a deterministic receive plan from prefetched data.
 *
 * This module is part of the **Functional Core**. It MUST NOT:
 * - Touch DB / network / filesystem
 * - Call Date.now(), Math.random(), or read process.env
 * - Depend on global state
 *
 * It accepts the prefetched data (products, batches, default suppliers,
 * previous PO prices) as explicit input and produces a deterministic
 * `ReceivePlan` that the shell layer executes inside a Prisma transaction.
 *
 * Business logic reference: `src/app/api/purchase-orders/[id]/route.ts`
 * `handleReceiveGoods` (lines 71-271). Calculation formulas must remain
 * identical to preserve behavior (zero regression).
 */

// ──────────────────────────────────────────────────────────────────────────
// Input types
// ──────────────────────────────────────────────────────────────────────────

export interface PrefetchedProduct {
  id: string;
  stock: number;
  purchase_price: number | null;
  hpp_price: number | null;
  hppCalculationDetails: unknown | null;
  conversionTargetId: string | null;
  conversionRate: number | null;
}

export interface PrefetchedBatch {
  productId: string;
  stock: number;
}

export interface PrefetchedDefaultSupplier {
  productId: string;
}

export interface PrefetchedPreviousPoPrice {
  productId: string;
  price: number;
}

export interface PrefetchedData {
  products: PrefetchedProduct[];
  batches: PrefetchedBatch[];
  defaultSuppliers: PrefetchedDefaultSupplier[];
  previousPoPrices: PrefetchedPreviousPoPrice[];
}

export interface ExistingPoItem {
  id: string;
  productId: string;
  quantity: number;
  receivedQuantity: number | null;
  price: number | string;
}

export interface ReceiveBatchInput {
  quantity: number;
  expiryDate?: string | Date | null;
  batchNumber?: string | null;
}

export interface ReceiveItemInput {
  id: string; // PO item ID
  receivedQuantity: number;
  batches?: ReceiveBatchInput[];
}

// ──────────────────────────────────────────────────────────────────────────
// Output types
// ──────────────────────────────────────────────────────────────────────────

export interface BatchCreateOperation {
  kind: "createBatch";
  productId: string;
  poItemId: string;
  receivedQuantity: number;
  /**
   * Batch payload — `null` means the shell should fall back to
   * `BatchService.addGenericBatch(receivedQuantity)`. A non-null payload
   * means the shell should call `BatchService.addBatch(payload)`.
   */
  batch: {
    stock: number;
    expiryDate?: Date | null;
    batchNumber?: string | null;
    purchasePrice: number;
  } | null;
}

export interface ProductUpdateOperation {
  kind: "updateProductWeightedAvg";
  productId: string;
  poItemId: string;
  newPurchasePrice: number;
  hppCalculationDetails: unknown | null;
}

export interface SupplierUpsertOperation {
  kind: "upsertProductSupplier";
  productId: string;
  supplierId: string;
  price: number;
  isDefault: boolean;
}

export interface PriceHistoryOperation {
  kind: "createPriceHistory";
  productId: string;
  storeId: string;
  oldPrice: number;
  newPrice: number;
  changeAmount: number;
  changePercentage: number;
  source: "SYSTEM_RECEIVE";
  referenceId: string; // purchaseOrderId
}

export interface ChildCascadeOperation {
  kind: "cascadeToChild";
  parentProductId: string;
  childProductId: string;
  conversionRate: number;
  newPurchasePrice: number;
  oldChildPurchasePrice: number;
  childHppCalculationDetails: unknown | null;
  storeId: string;
  referenceId: string; // purchaseOrderId
}

export interface ChildPriceHistoryOperation {
  kind: "createPriceHistoryChild";
  productId: string; // childProductId
  storeId: string;
  oldPrice: number;
  newPrice: number;
  changeAmount: number;
  changePercentage: number;
  source: "SYSTEM_CASCADE";
  referenceId: string;
}

export interface ReceivedQuantityOperation {
  kind: "incrementReceivedQuantity";
  poItemId: string;
  quantity: number;
}

export type ReceiveOperation =
  | BatchCreateOperation
  | ProductUpdateOperation
  | SupplierUpsertOperation
  | PriceHistoryOperation
  | ChildCascadeOperation
  | ChildPriceHistoryOperation
  | ReceivedQuantityOperation;

export interface ReceiveItemPlan {
  poItemId: string;
  productId: string;
  operations: ReceiveOperation[];
}

export interface ReceivePlan {
  items: ReceiveItemPlan[];
}

export interface ComputeReceivePlanParams {
  poId: string;
  storeId: string;
  supplierId: string;
  existingPoItems: ExistingPoItem[];
  receiveItems: ReceiveItemInput[];
  prefetched: PrefetchedData;
}

// ──────────────────────────────────────────────────────────────────────────
// Internal helpers (pure)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Sum batch stock for a product, given the raw prefetched batches list.
 * Reduces on the client side to mirror the in-transaction aggregate.
 */
function sumBatchStock(
  batches: PrefetchedBatch[],
  productId: string
): number {
  return batches.reduce((sum, b) => {
    if (b.productId !== productId) return sum;
    const numeric = typeof b.stock === "number" ? b.stock : Number(b.stock);
    return sum + (Number.isFinite(numeric) ? numeric : 0);
  }, 0);
}

/**
 * Build a Set of productIds that already have a default supplier.
 */
function buildDefaultSupplierSet(
  suppliers: PrefetchedDefaultSupplier[]
): Set<string> {
  const set = new Set<string>();
  for (const s of suppliers) {
    if (s.productId) set.add(s.productId);
  }
  return set;
}

/**
 * Lookup previous PO price for a product. Returns 0 if not found,
 * mirroring `previousPOItems[0]?.price ?? 0` from the original handler.
 */
function lookupPreviousPoPrice(
  previousPoPrices: PrefetchedPreviousPoPrice[],
  productId: string
): number {
  const found = previousPoPrices.find((p) => p.productId === productId);
  return found?.price ?? 0;
}

/**
 * Lookup a product in the prefetched products list.
 */
function findProduct(
  products: PrefetchedProduct[],
  productId: string
): PrefetchedProduct | undefined {
  return products.find((p) => p.id === productId);
}

// ──────────────────────────────────────────────────────────────────────────
// Main pure function
// ──────────────────────────────────────────────────────────────────────────

export function computeReceivePlan(
  params: ComputeReceivePlanParams
): ReceivePlan {
  const {
    poId,
    storeId,
    supplierId,
    existingPoItems,
    receiveItems,
    prefetched,
  } = params;

  const { products, batches, defaultSuppliers, previousPoPrices } = prefetched;

  const defaultSupplierSet = buildDefaultSupplierSet(defaultSuppliers);

  // Build a map: poItemId → ExistingPoItem for O(1) lookup.
  const existingById = new Map<string, ExistingPoItem>();
  for (const item of existingPoItems) {
    existingById.set(item.id, item);
  }

  // Iterate receiveItems in the SAME order as existingPoItems so the plan
  // mirrors the original sequential loop and is deterministic. Any
  // receiveItem that doesn't match an existingPoItem is silently ignored,
  // matching the `if (!currentItem) continue;` behavior in the route.
  const orderedReceiveItems = receiveItems
    .map((ri) => {
      const existing = existingById.get(ri.id);
      return existing ? { receive: ri, existing } : null;
    })
    .filter(
      (x): x is { receive: ReceiveItemInput; existing: ExistingPoItem } =>
        x !== null
    );

  // Sort by existingPoItems order (using the original index) so the plan
  // order matches `existingPO.items` order regardless of how the receive
  // request was ordered.
  const indexById = new Map<string, number>();
  existingPoItems.forEach((it, idx) => indexById.set(it.id, idx));
  orderedReceiveItems.sort(
    (a, b) =>
      (indexById.get(a.receive.id) ?? 0) -
      (indexById.get(b.receive.id) ?? 0)
  );

  const items: ReceiveItemPlan[] = [];

  for (const { receive, existing } of orderedReceiveItems) {
    if (receive.receivedQuantity <= 0) {
      // Skip zero-quantity receives (matches original handler's
      // `if (receivedItem.receivedQuantity > 0)` guard).
      continue;
    }

    const product = findProduct(products, existing.productId);
    if (!product) {
      // Prefetched products are required to plan for an item. Skip if
      // missing — shell layer should always prefetch all referenced ids.
      continue;
    }

    const operations: ReceiveOperation[] = [];

    const newPurchasePrice = extractNumericPrice(existing.price);
    const existingStock = sumBatchStock(batches, product.id);

    // 1) Batch creation — always emit. Each batch detail → one operation.
    //    If no batch details provided → single op with `batch: null` to
    //    signal `addGenericBatch`.
    if (receive.batches && receive.batches.length > 0) {
      for (const batch of receive.batches) {
        if (batch.quantity <= 0) continue;
        operations.push({
          kind: "createBatch",
          productId: product.id,
          poItemId: existing.id,
          receivedQuantity: receive.receivedQuantity,
          batch: {
            stock: batch.quantity,
            expiryDate:
              batch.expiryDate instanceof Date
                ? batch.expiryDate
                : batch.expiryDate
                  ? new Date(batch.expiryDate)
                  : null,
            batchNumber: batch.batchNumber ?? null,
            purchasePrice: newPurchasePrice,
          },
        });
      }
    } else {
      operations.push({
        kind: "createBatch",
        productId: product.id,
        poItemId: existing.id,
        receivedQuantity: receive.receivedQuantity,
        batch: null, // shell will call BatchService.addGenericBatch
      });
    }

    // 2) Weighted-average product update.
    const newWeightedAvg = calculateWeightedAverage({
      existingStock,
      existingPrice: product.purchase_price,
      newStock: receive.receivedQuantity,
      newPrice: newPurchasePrice,
    });

    operations.push({
      kind: "updateProductWeightedAvg",
      productId: product.id,
      poItemId: existing.id,
      newPurchasePrice: newWeightedAvg,
      hppCalculationDetails: product.hppCalculationDetails,
    });

    // 3) ProductSupplier upsert.
    const isDefault = !defaultSupplierSet.has(product.id);
    operations.push({
      kind: "upsertProductSupplier",
      productId: product.id,
      supplierId,
      price: newPurchasePrice,
      isDefault,
    });

    // 4) Price history (only when previous PO price differs from new price).
    const previousPOPrice = lookupPreviousPoPrice(
      previousPoPrices,
      product.id
    );
    if (previousPOPrice !== newPurchasePrice) {
      const change = calculatePriceChange(previousPOPrice, newPurchasePrice);
      operations.push({
        kind: "createPriceHistory",
        productId: product.id,
        storeId,
        oldPrice: previousPOPrice,
        newPrice: newPurchasePrice,
        changeAmount: change.changeAmount,
        changePercentage: change.changePercentage,
        source: "SYSTEM_RECEIVE",
        referenceId: poId,
      });
    }

    // 5) Child cascade (only when conversionTargetId AND conversionRate set).
    if (
      product.conversionTargetId !== null &&
      product.conversionRate !== null &&
      product.conversionRate > 0
    ) {
      const childProduct = findProduct(products, product.conversionTargetId);
      // If child product is not in prefetched list, we still emit the
      // cascade op with whatever info we have; shell layer is responsible
      // for ensuring prefetched.products includes the child. We pass
      // `null` for missing child details.
      const oldChildPurchasePrice = childProduct?.purchase_price ?? 0;
      const childHppCalculationDetails =
        childProduct?.hppCalculationDetails ?? null;

      const newChildPurchasePrice = Math.round(
        newWeightedAvg / product.conversionRate
      );

      operations.push({
        kind: "cascadeToChild",
        parentProductId: product.id,
        childProductId: product.conversionTargetId,
        conversionRate: product.conversionRate,
        newPurchasePrice: newChildPurchasePrice,
        oldChildPurchasePrice,
        childHppCalculationDetails,
        storeId,
        referenceId: poId,
      });

      // Child price history only when child price actually changes.
      if (oldChildPurchasePrice !== newChildPurchasePrice) {
        const childChange = calculatePriceChange(
          oldChildPurchasePrice,
          newChildPurchasePrice
        );
        operations.push({
          kind: "createPriceHistoryChild",
          productId: product.conversionTargetId,
          storeId,
          oldPrice: oldChildPurchasePrice,
          newPrice: newChildPurchasePrice,
          changeAmount: childChange.changeAmount,
          changePercentage: childChange.changePercentage,
          source: "SYSTEM_CASCADE",
          referenceId: poId,
        });
      }
    }

    // 6) Always emit PO item received-quantity increment.
    operations.push({
      kind: "incrementReceivedQuantity",
      poItemId: existing.id,
      quantity: receive.receivedQuantity,
    });

    items.push({
      poItemId: existing.id,
      productId: product.id,
      operations,
    });
  }

  return { items };
}
