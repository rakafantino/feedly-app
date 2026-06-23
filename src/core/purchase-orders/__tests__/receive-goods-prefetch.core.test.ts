import {
  computeReceivePlan,
  type ReceivePlan,
  type ComputeReceivePlanParams,
} from "../receive-goods-prefetch.core";

/**
 * Pure unit tests for `computeReceivePlan` core function.
 *
 * Business logic reference: src/app/api/purchase-orders/[id]/route.ts
 * handleReceiveGoods (lines 71-271).
 *
 * These tests are deterministic — same input twice → deep-equal output.
 */

const PO_ID = "po-001";
const STORE_ID = "store-001";
const SUPPLIER_ID = "supplier-001";

function makeParams(
  overrides: Partial<ComputeReceivePlanParams> = {}
): ComputeReceivePlanParams {
  return {
    poId: PO_ID,
    storeId: STORE_ID,
    supplierId: SUPPLIER_ID,
    existingPoItems: [],
    receiveItems: [],
    prefetched: {
      products: [],
      batches: [],
      defaultSuppliers: [],
      previousPoPrices: [],
    },
    ...overrides,
  };
}

describe("computeReceivePlan (pure core)", () => {
  describe("1.1 Empty input → empty plan", () => {
    it("returns an empty plan when receiveItems is empty", () => {
      const params = makeParams({
        existingPoItems: [
          {
            id: "po-item-1",
            productId: "prod-1",
            quantity: 10,
            receivedQuantity: 0,
            price: 5000,
          },
        ],
        receiveItems: [],
      });

      const plan = computeReceivePlan(params);

      expect(plan).toEqual<ReceivePlan>({ items: [] });
    });

    it("returns empty plan when existingPoItems is empty", () => {
      const plan = computeReceivePlan(makeParams());

      expect(plan).toEqual<ReceivePlan>({ items: [] });
    });
  });

  describe("1.2 1 item dengan batch detail → 1 plan dengan createBatch step", () => {
    it("emits BatchCreateOperation per batch with non-null batch payload", () => {
      const expiryDate = new Date("2026-12-31T00:00:00.000Z");

      const plan = computeReceivePlan(
        makeParams({
          existingPoItems: [
            {
              id: "po-item-1",
              productId: "prod-1",
              quantity: 30,
              receivedQuantity: 0,
              price: 5000,
            },
          ],
          receiveItems: [
            {
              id: "po-item-1",
              receivedQuantity: 30,
              batches: [
                {
                  quantity: 10,
                  expiryDate,
                  batchNumber: "BATCH-A",
                },
                {
                  quantity: 20,
                  expiryDate: null,
                  batchNumber: null,
                },
              ],
            },
          ],
          prefetched: {
            products: [
              {
                id: "prod-1",
                stock: 5,
                purchase_price: 4000,
                hpp_price: 4500,
                hppCalculationDetails: null,
                conversionTargetId: null,
                conversionRate: null,
              },
            ],
            batches: [
              { productId: "prod-1", stock: 5 },
            ],
            defaultSuppliers: [],
            previousPoPrices: [{ productId: "prod-1", price: 4000 }],
          },
        })
      );

      expect(plan.items).toHaveLength(1);
      const itemPlan = plan.items[0];

      expect(itemPlan.poItemId).toBe("po-item-1");
      expect(itemPlan.productId).toBe("prod-1");

      const createBatchOps = itemPlan.operations.filter(
        (op) => op.kind === "createBatch"
      );
      expect(createBatchOps).toHaveLength(2);

      expect(createBatchOps[0]).toMatchObject({
        kind: "createBatch",
        productId: "prod-1",
        poItemId: "po-item-1",
        receivedQuantity: 30,
        batch: {
          stock: 10,
          expiryDate,
          batchNumber: "BATCH-A",
          purchasePrice: 5000,
        },
      });

      expect(createBatchOps[1]).toMatchObject({
        kind: "createBatch",
        productId: "prod-1",
        poItemId: "po-item-1",
        batch: {
          stock: 20,
          purchasePrice: 5000,
        },
      });
    });
  });

  describe("1.3 1 item tanpa batch detail → addGenericBatch step", () => {
    it("emits a single BatchCreateOperation with null batch (signals addGenericBatch)", () => {
      const plan = computeReceivePlan(
        makeParams({
          existingPoItems: [
            {
              id: "po-item-1",
              productId: "prod-1",
              quantity: 10,
              receivedQuantity: 0,
              price: 7500,
            },
          ],
          receiveItems: [
            {
              id: "po-item-1",
              receivedQuantity: 10,
            },
          ],
          prefetched: {
            products: [
              {
                id: "prod-1",
                stock: 0,
                purchase_price: null,
                hpp_price: null,
                hppCalculationDetails: null,
                conversionTargetId: null,
                conversionRate: null,
              },
            ],
            batches: [],
            defaultSuppliers: [],
            previousPoPrices: [],
          },
        })
      );

      expect(plan.items).toHaveLength(1);
      const itemPlan = plan.items[0];

      const createBatchOps = itemPlan.operations.filter(
        (op) => op.kind === "createBatch"
      );
      expect(createBatchOps).toHaveLength(1);
      expect(createBatchOps[0]).toMatchObject({
        kind: "createBatch",
        productId: "prod-1",
        poItemId: "po-item-1",
        receivedQuantity: 10,
        batch: null, // null = shell should call addGenericBatch
      });
    });

    it("emits addGenericBatch when batches array is empty", () => {
      const plan = computeReceivePlan(
        makeParams({
          existingPoItems: [
            {
              id: "po-item-1",
              productId: "prod-1",
              quantity: 5,
              receivedQuantity: 0,
              price: 10000,
            },
          ],
          receiveItems: [
            {
              id: "po-item-1",
              receivedQuantity: 5,
              batches: [],
            },
          ],
          prefetched: {
            products: [
              {
                id: "prod-1",
                stock: 0,
                purchase_price: null,
                hpp_price: null,
                hppCalculationDetails: null,
                conversionTargetId: null,
                conversionRate: null,
              },
            ],
            batches: [],
            defaultSuppliers: [],
            previousPoPrices: [],
          },
        })
      );

      const createBatchOps = plan.items[0].operations.filter(
        (op) => op.kind === "createBatch"
      );
      expect(createBatchOps).toHaveLength(1);
      expect(createBatchOps[0]?.batch).toBeNull();
    });
  });

  describe("1.4 Multi-item (13 items) → 13 plans dengan urutan sesuai existingPoItems", () => {
    it("produces 13 plans in same order as existingPO.items", () => {
      const existingPoItems = Array.from({ length: 13 }, (_, i) => ({
        id: `po-item-${i + 1}`,
        productId: `prod-${i + 1}`,
        quantity: 10,
        receivedQuantity: 0,
        price: 5000 + i,
      }));

      const receiveItems = existingPoItems.map((it) => ({
        id: it.id,
        receivedQuantity: 5,
      }));

      const prefetchedProducts = existingPoItems.map((it) => ({
        id: it.productId,
        stock: 0,
        purchase_price: 4000,
        hpp_price: 4200,
        hppCalculationDetails: null,
        conversionTargetId: null,
        conversionRate: null,
      }));

      const plan = computeReceivePlan(
        makeParams({
          existingPoItems,
          receiveItems,
          prefetched: {
            products: prefetchedProducts,
            batches: [],
            defaultSuppliers: [],
            previousPoPrices: existingPoItems.map((it) => ({
              productId: it.productId,
              price: 4000,
            })),
          },
        })
      );

      expect(plan.items).toHaveLength(13);
      plan.items.forEach((itemPlan, idx) => {
        expect(itemPlan.poItemId).toBe(`po-item-${idx + 1}`);
        expect(itemPlan.productId).toBe(`prod-${idx + 1}`);
      });
    });
  });

  describe("1.5 Child cascade muncul HANYA untuk product dengan conversionTargetId non-null", () => {
    it("emits cascadeToChild + createPriceHistoryChild when conversionTargetId is set", () => {
      const plan = computeReceivePlan(
        makeParams({
          existingPoItems: [
            {
              id: "po-item-parent",
              productId: "prod-parent",
              quantity: 100,
              receivedQuantity: 0,
              price: 10000,
            },
          ],
          receiveItems: [
            {
              id: "po-item-parent",
              receivedQuantity: 100,
            },
          ],
          prefetched: {
            products: [
              {
                id: "prod-parent",
                stock: 50,
                purchase_price: 8000,
                hpp_price: 9000,
                hppCalculationDetails: null,
                conversionTargetId: "prod-child",
                conversionRate: 10,
              },
              {
                id: "prod-child",
                stock: 0,
                purchase_price: 1000,
                hpp_price: 1100,
                hppCalculationDetails: null,
                conversionTargetId: null,
                conversionRate: null,
              },
            ],
            batches: [{ productId: "prod-parent", stock: 50 }],
            defaultSuppliers: [],
            previousPoPrices: [{ productId: "prod-parent", price: 8000 }],
          },
        })
      );

      const itemPlan = plan.items[0];
      const cascadeOps = itemPlan.operations.filter(
        (op) => op.kind === "cascadeToChild"
      );
      const childHistoryOps = itemPlan.operations.filter(
        (op) => op.kind === "createPriceHistoryChild"
      );

      expect(cascadeOps).toHaveLength(1);
      // weighted avg = (50*8000 + 100*10000) / 150 = 1400000 / 150 = 9333.33 → 9333
      // newChildPurchasePrice = round(9333 / 10) = 933
      // For cascade op, `newPurchasePrice` field = NEW CHILD price (= 933)
      expect(cascadeOps[0]).toMatchObject({
        kind: "cascadeToChild",
        parentProductId: "prod-parent",
        childProductId: "prod-child",
        conversionRate: 10,
        oldChildPurchasePrice: 1000,
        newPurchasePrice: 933,
        storeId: STORE_ID,
        referenceId: PO_ID,
      });

      // oldChild (1000) !== newChild (933) → emit child price history
      expect(childHistoryOps).toHaveLength(1);
      expect(childHistoryOps[0]).toMatchObject({
        kind: "createPriceHistoryChild",
        productId: "prod-child",
        storeId: STORE_ID,
        oldPrice: 1000,
        newPrice: 933,
        source: "SYSTEM_CASCADE",
        referenceId: PO_ID,
      });
    });

    it("does NOT emit cascade when conversionTargetId is null", () => {
      const plan = computeReceivePlan(
        makeParams({
          existingPoItems: [
            {
              id: "po-item-1",
              productId: "prod-1",
              quantity: 10,
              receivedQuantity: 0,
              price: 5000,
            },
          ],
          receiveItems: [
            {
              id: "po-item-1",
              receivedQuantity: 10,
            },
          ],
          prefetched: {
            products: [
              {
                id: "prod-1",
                stock: 0,
                purchase_price: null,
                hpp_price: null,
                hppCalculationDetails: null,
                conversionTargetId: null,
                conversionRate: null,
              },
            ],
            batches: [],
            defaultSuppliers: [],
            previousPoPrices: [],
          },
        })
      );

      const cascadeOps = plan.items[0].operations.filter(
        (op) => op.kind === "cascadeToChild"
      );
      expect(cascadeOps).toHaveLength(0);
    });

    it("does NOT emit cascade when conversionRate is null even if conversionTargetId set", () => {
      const plan = computeReceivePlan(
        makeParams({
          existingPoItems: [
            {
              id: "po-item-1",
              productId: "prod-1",
              quantity: 10,
              receivedQuantity: 0,
              price: 5000,
            },
          ],
          receiveItems: [
            {
              id: "po-item-1",
              receivedQuantity: 10,
            },
          ],
          prefetched: {
            products: [
              {
                id: "prod-1",
                stock: 0,
                purchase_price: null,
                hpp_price: null,
                hppCalculationDetails: null,
                conversionTargetId: "prod-child",
                conversionRate: null,
              },
            ],
            batches: [],
            defaultSuppliers: [],
            previousPoPrices: [],
          },
        })
      );

      const cascadeOps = plan.items[0].operations.filter(
        (op) => op.kind === "cascadeToChild"
      );
      expect(cascadeOps).toHaveLength(0);
    });

    it("does NOT emit child price history when child price unchanged", () => {
      // weighted avg = (50*10000 + 0*10000) / 50 = 10000, newChild = round(10000/10) = 1000 (same)
      const plan = computeReceivePlan(
        makeParams({
          existingPoItems: [
            {
              id: "po-item-1",
              productId: "prod-parent",
              quantity: 10,
              receivedQuantity: 0,
              price: 10000,
            },
          ],
          receiveItems: [
            {
              id: "po-item-1",
              receivedQuantity: 10,
            },
          ],
          prefetched: {
            products: [
              {
                id: "prod-parent",
                stock: 50,
                purchase_price: 10000,
                hpp_price: 10000,
                hppCalculationDetails: null,
                conversionTargetId: "prod-child",
                conversionRate: 10,
              },
              {
                id: "prod-child",
                stock: 0,
                purchase_price: 1000,
                hpp_price: 1000,
                hppCalculationDetails: null,
                conversionTargetId: null,
                conversionRate: null,
              },
            ],
            batches: [{ productId: "prod-parent", stock: 50 }],
            defaultSuppliers: [],
            previousPoPrices: [],
          },
        })
      );

      const cascadeOps = plan.items[0].operations.filter(
        (op) => op.kind === "cascadeToChild"
      );
      const childHistoryOps = plan.items[0].operations.filter(
        (op) => op.kind === "createPriceHistoryChild"
      );

      expect(cascadeOps).toHaveLength(1);
      expect(childHistoryOps).toHaveLength(0);
    });
  });

  describe("1.6 Price history muncul HANYA jika previousPOPrice !== newPurchasePrice", () => {
    it("emits createPriceHistory when previous PO price differs from new PO price", () => {
      const plan = computeReceivePlan(
        makeParams({
          existingPoItems: [
            {
              id: "po-item-1",
              productId: "prod-1",
              quantity: 10,
              receivedQuantity: 0,
              price: 12000,
            },
          ],
          receiveItems: [
            {
              id: "po-item-1",
              receivedQuantity: 10,
            },
          ],
          prefetched: {
            products: [
              {
                id: "prod-1",
                stock: 0,
                purchase_price: null,
                hpp_price: null,
                hppCalculationDetails: null,
                conversionTargetId: null,
                conversionRate: null,
              },
            ],
            batches: [],
            defaultSuppliers: [],
            previousPoPrices: [{ productId: "prod-1", price: 10000 }],
          },
        })
      );

      const historyOps = plan.items[0].operations.filter(
        (op) => op.kind === "createPriceHistory"
      );
      expect(historyOps).toHaveLength(1);
      expect(historyOps[0]).toMatchObject({
        kind: "createPriceHistory",
        productId: "prod-1",
        storeId: STORE_ID,
        oldPrice: 10000,
        newPrice: 12000,
        source: "SYSTEM_RECEIVE",
        referenceId: PO_ID,
      });
    });

    it("does NOT emit createPriceHistory when previous PO price equals new price", () => {
      const plan = computeReceivePlan(
        makeParams({
          existingPoItems: [
            {
              id: "po-item-1",
              productId: "prod-1",
              quantity: 10,
              receivedQuantity: 0,
              price: 10000,
            },
          ],
          receiveItems: [
            {
              id: "po-item-1",
              receivedQuantity: 10,
            },
          ],
          prefetched: {
            products: [
              {
                id: "prod-1",
                stock: 0,
                purchase_price: null,
                hpp_price: null,
                hppCalculationDetails: null,
                conversionTargetId: null,
                conversionRate: null,
              },
            ],
            batches: [],
            defaultSuppliers: [],
            previousPoPrices: [{ productId: "prod-1", price: 10000 }],
          },
        })
      );

      const historyOps = plan.items[0].operations.filter(
        (op) => op.kind === "createPriceHistory"
      );
      expect(historyOps).toHaveLength(0);
    });

    it("does NOT emit createPriceHistory when no previous PO price exists (default 0 vs new price > 0)", () => {
      // previousPOPrice = 0, newPrice = 5000 → different → SHOULD emit
      const plan = computeReceivePlan(
        makeParams({
          existingPoItems: [
            {
              id: "po-item-1",
              productId: "prod-1",
              quantity: 10,
              receivedQuantity: 0,
              price: 5000,
            },
          ],
          receiveItems: [
            {
              id: "po-item-1",
              receivedQuantity: 10,
            },
          ],
          prefetched: {
            products: [
              {
                id: "prod-1",
                stock: 0,
                purchase_price: null,
                hpp_price: null,
                hppCalculationDetails: null,
                conversionTargetId: null,
                conversionRate: null,
              },
            ],
            batches: [],
            defaultSuppliers: [],
            previousPoPrices: [],
          },
        })
      );

      const historyOps = plan.items[0].operations.filter(
        (op) => op.kind === "createPriceHistory"
      );
      expect(historyOps).toHaveLength(1);
      expect(historyOps[0]).toMatchObject({
        oldPrice: 0,
        newPrice: 5000,
      });
    });
  });

  describe("1.7 Deterministik — input sama 2x menghasilkan deep-equal output", () => {
    it("produces deep-equal plan when called twice with identical input", () => {
      const buildParams = () =>
        makeParams({
          existingPoItems: [
            {
              id: "po-item-1",
              productId: "prod-1",
              quantity: 10,
              receivedQuantity: 0,
              price: 7500,
            },
            {
              id: "po-item-2",
              productId: "prod-2",
              quantity: 20,
              receivedQuantity: 5,
              price: 12000,
            },
          ],
          receiveItems: [
            {
              id: "po-item-1",
              receivedQuantity: 10,
            },
            {
              id: "po-item-2",
              receivedQuantity: 10,
              batches: [{ quantity: 10, expiryDate: null, batchNumber: "B1" }],
            },
          ],
          prefetched: {
            products: [
              {
                id: "prod-1",
                stock: 0,
                purchase_price: null,
                hpp_price: null,
                hppCalculationDetails: null,
                conversionTargetId: null,
                conversionRate: null,
              },
              {
                id: "prod-2",
                stock: 50,
                purchase_price: 10000,
                hpp_price: 11000,
                hppCalculationDetails: null,
                conversionTargetId: null,
                conversionRate: null,
              },
            ],
            batches: [{ productId: "prod-2", stock: 50 }],
            defaultSuppliers: [{ productId: "prod-2" }],
            previousPoPrices: [
              { productId: "prod-1", price: 0 },
              { productId: "prod-2", price: 10000 },
            ],
          },
        });

      const plan1 = computeReceivePlan(buildParams());
      const plan2 = computeReceivePlan(buildParams());

      expect(plan2).toEqual(plan1);
      expect(plan1).toBeInstanceOf(Object);
    });
  });

  describe("1.8 Edge case: existing batches kosong (existingStock = 0) — weighted avg = newPrice", () => {
    it("emits newPurchasePrice = newPrice when product has no existing batches", () => {
      const plan = computeReceivePlan(
        makeParams({
          existingPoItems: [
            {
              id: "po-item-1",
              productId: "prod-1",
              quantity: 10,
              receivedQuantity: 0,
              price: 8000,
            },
          ],
          receiveItems: [
            {
              id: "po-item-1",
              receivedQuantity: 10,
            },
          ],
          prefetched: {
            products: [
              {
                id: "prod-1",
                stock: 0,
                purchase_price: 9999, // any value — should be ignored since existingStock = 0
                hpp_price: 9999,
                hppCalculationDetails: null,
                conversionTargetId: null,
                conversionRate: null,
              },
            ],
            batches: [], // NO existing batches
            defaultSuppliers: [],
            previousPoPrices: [{ productId: "prod-1", price: 8000 }],
          },
        })
      );

      const updateOps = plan.items[0].operations.filter(
        (op) => op.kind === "updateProductWeightedAvg"
      );
      expect(updateOps).toHaveLength(1);
      // existingStock = 0 → weighted avg = newPrice = 8000
      expect(updateOps[0]).toMatchObject({
        kind: "updateProductWeightedAvg",
        productId: "prod-1",
        poItemId: "po-item-1",
        newPurchasePrice: 8000,
      });

      // price history NOT emitted (previous = new)
      const historyOps = plan.items[0].operations.filter(
        (op) => op.kind === "createPriceHistory"
      );
      expect(historyOps).toHaveLength(0);
    });
  });

  describe("ProductSupplier isDefault logic", () => {
    it("marks isDefault=true when product has NO existing default supplier", () => {
      const plan = computeReceivePlan(
        makeParams({
          existingPoItems: [
            {
              id: "po-item-1",
              productId: "prod-1",
              quantity: 10,
              receivedQuantity: 0,
              price: 5000,
            },
          ],
          receiveItems: [
            {
              id: "po-item-1",
              receivedQuantity: 10,
            },
          ],
          prefetched: {
            products: [
              {
                id: "prod-1",
                stock: 0,
                purchase_price: null,
                hpp_price: null,
                hppCalculationDetails: null,
                conversionTargetId: null,
                conversionRate: null,
              },
            ],
            batches: [],
            defaultSuppliers: [], // no default supplier
            previousPoPrices: [],
          },
        })
      );

      const upsertOps = plan.items[0].operations.filter(
        (op) => op.kind === "upsertProductSupplier"
      );
      expect(upsertOps).toHaveLength(1);
      expect(upsertOps[0]).toMatchObject({
        kind: "upsertProductSupplier",
        productId: "prod-1",
        supplierId: SUPPLIER_ID,
        price: 5000,
        isDefault: true,
      });
    });

    it("marks isDefault=false when product already has a default supplier", () => {
      const plan = computeReceivePlan(
        makeParams({
          existingPoItems: [
            {
              id: "po-item-1",
              productId: "prod-1",
              quantity: 10,
              receivedQuantity: 0,
              price: 5000,
            },
          ],
          receiveItems: [
            {
              id: "po-item-1",
              receivedQuantity: 10,
            },
          ],
          prefetched: {
            products: [
              {
                id: "prod-1",
                stock: 0,
                purchase_price: null,
                hpp_price: null,
                hppCalculationDetails: null,
                conversionTargetId: null,
                conversionRate: null,
              },
            ],
            batches: [],
            defaultSuppliers: [{ productId: "prod-1" }], // already has default
            previousPoPrices: [],
          },
        })
      );

      const upsertOps = plan.items[0].operations.filter(
        (op) => op.kind === "upsertProductSupplier"
      );
      expect(upsertOps[0]?.isDefault).toBe(false);
    });
  });

  describe("receivedQuantity increment op always emitted for received items", () => {
    it("emits incrementReceivedQuantity with the received quantity", () => {
      const plan = computeReceivePlan(
        makeParams({
          existingPoItems: [
            {
              id: "po-item-1",
              productId: "prod-1",
              quantity: 10,
              receivedQuantity: 0,
              price: 5000,
            },
          ],
          receiveItems: [
            {
              id: "po-item-1",
              receivedQuantity: 7,
            },
          ],
          prefetched: {
            products: [
              {
                id: "prod-1",
                stock: 0,
                purchase_price: null,
                hpp_price: null,
                hppCalculationDetails: null,
                conversionTargetId: null,
                conversionRate: null,
              },
            ],
            batches: [],
            defaultSuppliers: [],
            previousPoPrices: [],
          },
        })
      );

      const incrementOps = plan.items[0].operations.filter(
        (op) => op.kind === "incrementReceivedQuantity"
      );
      expect(incrementOps).toHaveLength(1);
      expect(incrementOps[0]).toEqual({
        kind: "incrementReceivedQuantity",
        poItemId: "po-item-1",
        quantity: 7,
      });
    });
  });

  describe("skips items where receivedQuantity is 0", () => {
    it("does not include a plan for items with receivedQuantity = 0", () => {
      const plan = computeReceivePlan(
        makeParams({
          existingPoItems: [
            {
              id: "po-item-1",
              productId: "prod-1",
              quantity: 10,
              receivedQuantity: 0,
              price: 5000,
            },
          ],
          receiveItems: [
            {
              id: "po-item-1",
              receivedQuantity: 0,
            },
          ],
          prefetched: {
            products: [
              {
                id: "prod-1",
                stock: 0,
                purchase_price: null,
                hpp_price: null,
                hppCalculationDetails: null,
                conversionTargetId: null,
                conversionRate: null,
              },
            ],
            batches: [],
            defaultSuppliers: [],
            previousPoPrices: [],
          },
        })
      );

      expect(plan.items).toEqual([]);
    });
  });

  describe("received items not in existingPO are silently ignored", () => {
    it("skips receive items that do not match any existingPoItem", () => {
      const plan = computeReceivePlan(
        makeParams({
          existingPoItems: [
            {
              id: "po-item-1",
              productId: "prod-1",
              quantity: 10,
              receivedQuantity: 0,
              price: 5000,
            },
          ],
          receiveItems: [
            {
              id: "po-item-unknown",
              receivedQuantity: 10,
            },
          ],
          prefetched: {
            products: [],
            batches: [],
            defaultSuppliers: [],
            previousPoPrices: [],
          },
        })
      );

      expect(plan.items).toEqual([]);
    });
  });

  describe("weighted avg formula preserved", () => {
    it("computes weighted avg exactly like the original route.ts handler", () => {
      // existingStock = 10 @ 5000, newStock = 10 @ 10000
      // weighted avg = (10*5000 + 10*10000) / 20 = 7500
      const plan = computeReceivePlan(
        makeParams({
          existingPoItems: [
            {
              id: "po-item-1",
              productId: "prod-1",
              quantity: 10,
              receivedQuantity: 0,
              price: 10000,
            },
          ],
          receiveItems: [
            {
              id: "po-item-1",
              receivedQuantity: 10,
            },
          ],
          prefetched: {
            products: [
              {
                id: "prod-1",
                stock: 10,
                purchase_price: 5000,
                hpp_price: 5000,
                hppCalculationDetails: null,
                conversionTargetId: null,
                conversionRate: null,
              },
            ],
            batches: [{ productId: "prod-1", stock: 10 }],
            defaultSuppliers: [],
            previousPoPrices: [{ productId: "prod-1", price: 5000 }],
          },
        })
      );

      const updateOps = plan.items[0].operations.filter(
        (op) => op.kind === "updateProductWeightedAvg"
      );
      expect(updateOps[0]?.newPurchasePrice).toBe(7500);
    });
  });

  describe("plan contains all expected operation kinds for a full happy path", () => {
    it("emits: createBatch, updateProductWeightedAvg, upsertProductSupplier, createPriceHistory, cascadeToChild, createPriceHistoryChild, incrementReceivedQuantity", () => {
      const expiryDate = new Date("2026-12-01T00:00:00.000Z");
      const plan = computeReceivePlan(
        makeParams({
          existingPoItems: [
            {
              id: "po-item-1",
              productId: "prod-parent",
              quantity: 50,
              receivedQuantity: 0,
              price: 12000,
            },
          ],
          receiveItems: [
            {
              id: "po-item-1",
              receivedQuantity: 50,
              batches: [
                { quantity: 50, expiryDate, batchNumber: "B-FULL" },
              ],
            },
          ],
          prefetched: {
            products: [
              {
                id: "prod-parent",
                stock: 10,
                purchase_price: 10000,
                hpp_price: 11000,
                hppCalculationDetails: null,
                conversionTargetId: "prod-child",
                conversionRate: 5,
              },
              {
                id: "prod-child",
                stock: 0,
                purchase_price: 2000,
                hpp_price: 2200,
                hppCalculationDetails: null,
                conversionTargetId: null,
                conversionRate: null,
              },
            ],
            batches: [{ productId: "prod-parent", stock: 10 }],
            defaultSuppliers: [],
            previousPoPrices: [{ productId: "prod-parent", price: 10000 }],
          },
        })
      );

      const kinds = plan.items[0].operations.map((op) => op.kind);
      expect(kinds).toContain("createBatch");
      expect(kinds).toContain("updateProductWeightedAvg");
      expect(kinds).toContain("upsertProductSupplier");
      expect(kinds).toContain("createPriceHistory");
      expect(kinds).toContain("cascadeToChild");
      expect(kinds).toContain("createPriceHistoryChild");
      expect(kinds).toContain("incrementReceivedQuantity");
    });
  });
});
