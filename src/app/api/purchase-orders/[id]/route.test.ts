import { PUT } from "./route";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma"; // This imports the mocked version
import { BatchService } from "@/services/batch.service";

// Make sure transaction calls callback
(prisma.$transaction as jest.Mock).mockImplementation((callback: any) => callback(prisma));

// Mock module using the defined object
// Note: In Jest, we often need to be careful with hoisting.
// But assigning implementation outside factory relies on import.
// Safer way for strictly hoisted jest.mock:
jest.mock("@/lib/prisma", () => {
  // Proper way to circular ref in factory:
  const client: any = {
    purchaseOrder: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
    product: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    purchaseOrderItem: { update: jest.fn(), findMany: jest.fn() },
    productBatch: { create: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    priceHistory: { create: jest.fn() },
    productSupplier: { findFirst: jest.fn(), findMany: jest.fn(), upsert: jest.fn(), update: jest.fn() },
  };
  client.$transaction = jest.fn((cb: any) => cb(client));

  return {
    __esModule: true,
    default: client,
  };
});

jest.mock("@/lib/api-middleware", () => ({
  withAuth: (handler: any) => handler,
}));

jest.mock("@/lib/store-access", () => ({
  validateStoreAccess: jest.fn().mockResolvedValue({ valid: true, role: "OWNER" }),
  hasPermission: jest.fn().mockReturnValue(true),
}));

jest.mock("@/services/batch.service", () => ({
  BatchService: {
    addBatch: jest.fn(),
    addGenericBatch: jest.fn(),
  },
}));

describe("PUT /api/purchase-orders/[id]", () => {
  const storeId = "store-123";
  const poId = "po-123";
  const productId = "prod-123";

  beforeEach(() => {
    jest.resetAllMocks();
    (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.productBatch.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.purchaseOrderItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.productSupplier.findMany as jest.Mock).mockResolvedValue([]);
    
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
      // Create a mock transaction object that matches Prisma transaction client
      const txMock = {
        ...prisma,
        productBatch: {
          ...prisma.productBatch,
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        transactionItem: {
          ...prisma.transactionItem,
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      };
      return await callback(txMock);
    });
  });

  it("should keep payment fields in the response after a status update", async () => {
    const dueDate = new Date("2026-06-15T00:00:00.000Z");
    const existingPO = {
      id: poId,
      poNumber: "PO-001",
      status: "draft",
      storeId: storeId,
      paymentStatus: "PARTIAL",
      amountPaid: 250000,
      remainingAmount: 750000,
      totalAmount: 1000000,
      dueDate,
      notes: null,
      items: [{ id: "item-1", productId: productId, quantity: 10, receivedQuantity: 0, price: 100000, unit: "pcs", product: { name: "Test Product" } }],
      supplierId: "sup-1",
      supplier: { id: "sup-1", name: "Supplier 1", phone: null, address: null, email: null, code: "SUP-1" },
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      estimatedDelivery: null,
      payments: [],
    };

    const updatedPO = {
      ...existingPO,
      status: "ordered",
    };

    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValueOnce(existingPO).mockResolvedValueOnce(updatedPO);

    const req = new NextRequest(`http://localhost:3000/api/purchase-orders/${poId}`, {
      method: "PUT",
      body: JSON.stringify({ status: "ordered" }),
    });

    const response = await PUT(req, {}, storeId);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.purchaseOrder).toEqual(
      expect.objectContaining({
        paymentStatus: "PARTIAL",
        amountPaid: 250000,
        remainingAmount: 750000,
        totalAmount: 1000000,
        dueDate: dueDate.toISOString(),
      }),
    );
  });

  it("should handle retroactive price updates and recalculate payment fields", async () => {
    const existingPO = {
      id: poId,
      poNumber: "PO-001",
      status: "ordered",
      storeId: storeId,
      paymentStatus: "PARTIAL",
      amountPaid: 5000,
      remainingAmount: 5000,
      totalAmount: 10000,
      dueDate: null,
      notes: null,
      items: [{ id: "item-1", productId: productId, quantity: 10, receivedQuantity: 0, price: 1000, unit: "pcs", product: { name: "Test Product" } }],
      supplierId: "sup-1",
      supplier: { id: "sup-1", name: "Supplier 1", phone: null, address: null, email: null, code: "SUP-1" },
      createdAt: new Date("2026-05-01T00:00:00.000Z"),
      estimatedDelivery: null,
      payments: [],
    };

    const updatedPO = {
      ...existingPO,
      totalAmount: 12000,
      remainingAmount: 7000,
      items: [{ ...existingPO.items[0], price: 1200 }],
    };

    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValueOnce(existingPO).mockResolvedValueOnce(updatedPO);
    (prisma.product.findUnique as jest.Mock).mockResolvedValueOnce({ id: productId, purchase_price: 1000, hppCalculationDetails: null });
    (prisma.product.update as jest.Mock).mockResolvedValueOnce({ id: productId, purchase_price: 1200, conversionTargetId: null, conversionRate: null });

    const req = new NextRequest(`http://localhost:3000/api/purchase-orders/${poId}`, {
      method: "PUT",
      body: JSON.stringify({
        action: "update_prices",
        items: [{ id: "item-1", price: 1200 }],
      }),
    });

    const response = await PUT(req, {}, storeId);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.purchaseOrderItem.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { price: 1200 },
    });
    expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
      where: { id: poId },
      data: {
        totalAmount: 12000,
        remainingAmount: 7000,
        paymentStatus: "PARTIAL",
      },
    });
    expect(data.purchaseOrder).toEqual(
      expect.objectContaining({
        totalAmount: 12000,
        remainingAmount: 7000,
        paymentStatus: "PARTIAL",
      }),
    );
  });

  it("should create generic batch when status changes to received (Legacy/Full)", async () => {
    const existingPO = {
      id: poId,
      status: "ordered",
      storeId: storeId,
      items: [{ id: "item-1", productId: productId, quantity: 10, receivedQuantity: 0, price: 1000, product: { name: "Test Product" } }],
      supplier: { id: "sup-1", name: "Supplier 1" },
      createdAt: new Date(),
      payments: [],
    };

    const updatedPO = {
      ...existingPO,
      status: "received",
      items: [
        {
          ...existingPO.items[0],
          product: { name: "Test Product" },
        },
      ],
      supplier: { id: "sup-1", name: "Supplier 1" },
      createdAt: new Date(),
      estimatedDelivery: null,
      payments: [],
    };

    // Use findFirst instead of findUnique for store isolation
    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValueOnce(existingPO).mockResolvedValueOnce(updatedPO);

    (prisma.purchaseOrder.update as jest.Mock).mockResolvedValue(updatedPO);

    const req = new NextRequest(`http://localhost:3000/api/purchase-orders/${poId}`, {
      method: "PUT",
      body: JSON.stringify({ status: "received" }),
    });

    const response = await PUT(req, {}, storeId);
    const data = await response.json();

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(BatchService.addGenericBatch).toHaveBeenCalledWith(productId, 10, expect.anything());
    expect(data.purchaseOrder.status).toBe("received");
  });

  it("should handle partial receipt correctly", async () => {
    const existingPO = {
      id: poId,
      status: "ordered",
      storeId: storeId,
      items: [{ id: "item-1", productId: productId, quantity: 10, receivedQuantity: 0, price: 1000, product: { name: "Test Product" } }],
      supplier: { id: "sup-1", name: "Supplier 1" },
      createdAt: new Date(),
      payments: [],
    };

    const updatedPO = {
      ...existingPO,
      status: "partially_received",
      items: [{ ...existingPO.items[0], receivedQuantity: 5, product: { name: "Test Product" } }],
      supplier: { id: "sup-1", name: "Supplier 1" },
      createdAt: new Date(),
      estimatedDelivery: null,
      payments: [],
    };

    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValueOnce(existingPO).mockResolvedValueOnce(updatedPO);

    (prisma.product.update as jest.Mock).mockResolvedValue({ id: productId, name: "Test Product", purchase_price: 1000 });
    // Prefetch mocks (refactor: prefetch uses findMany with id IN clause)
    (prisma.product.findMany as jest.Mock).mockResolvedValueOnce([
      { id: productId, stock: 0, purchase_price: 1000, hpp_price: 1000, hppCalculationDetails: null, conversionTargetId: null, conversionRate: null }
    ]);
    (prisma.productBatch.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.productSupplier.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.purchaseOrderItem.findMany as jest.Mock).mockResolvedValueOnce([]);
    const req = new NextRequest(`http://localhost:3000/api/purchase-orders/${poId}`, {
      method: "PUT",
      body: JSON.stringify({
        items: [{ id: "item-1", receivedQuantity: 5 }],
        closePo: false,
      }),
    });

    const response = await PUT(req, {}, storeId);
    await response.json();

    expect(BatchService.addGenericBatch).toHaveBeenCalledWith(productId, 5, expect.anything());

    expect(prisma.purchaseOrderItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "item-1" },
        data: { receivedQuantity: { increment: 5 } },
      }),
    );

    expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "partially_received" }),
      }),
    );
  });

  it("should keep status as partially_received when one item is fully received but another item has not been received yet (multi-item PO)", async () => {
    // Regression test: previously the status was determined only by iterating
    // over the items in the receive request, so an item that was intentionally
    // omitted (e.g. still in transit) was ignored. That caused the PO to
    // prematurely flip to "received", hiding the receive button.
    const existingPO = {
      id: poId,
      status: "ordered",
      storeId: storeId,
      items: [
        { id: "item-1", productId: productId, quantity: 5, receivedQuantity: 0, price: 1000, product: { name: "Satria-5" } },
        { id: "item-2", productId: "prod-456", quantity: 4, receivedQuantity: 0, price: 2000, product: { name: "Hiprovite 782-4" } },
      ],
      supplierId: "sup-1",
      supplier: { id: "sup-1", name: "Supplier 1" },
      createdAt: new Date(),
      payments: [],
    };

    const updatedPO = {
      ...existingPO,
      status: "partially_received",
      items: existingPO.items.map((i) => ({ ...i, product: i.product })),
      supplier: { id: "sup-1", name: "Supplier 1" },
      createdAt: new Date(),
      estimatedDelivery: null,
      payments: [],
    };

    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValueOnce(existingPO).mockResolvedValueOnce(updatedPO);
    (prisma.product.update as jest.Mock).mockResolvedValue({ id: productId, name: "Satria-5", purchase_price: 1000 });
    // Prefetch mocks (refactor)
    (prisma.product.findMany as jest.Mock).mockResolvedValueOnce([
      { id: productId, stock: 5, purchase_price: 1000, hpp_price: 1000, hppCalculationDetails: null, conversionTargetId: null, conversionRate: null }
    ]);
    (prisma.productBatch.findMany as jest.Mock).mockResolvedValueOnce([{ productId, stock: 5 }]);
    (prisma.productSupplier.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.purchaseOrderItem.findMany as jest.Mock).mockResolvedValueOnce([]);
    (prisma.productSupplier.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (prisma.purchaseOrderItem.update as jest.Mock).mockResolvedValue({});
    (prisma.purchaseOrder.update as jest.Mock).mockResolvedValue(updatedPO);

    // Frontend only sends item-1 (Satria-5 fully received). item-2 (Hiprovite
    // 782-4) is omitted because the user cleared its qty — shipment is delayed.
    const req = new NextRequest(`http://localhost:3000/api/purchase-orders/${poId}`, {
      method: "PUT",
      body: JSON.stringify({
        items: [{ id: "item-1", receivedQuantity: 5 }],
        closePo: false,
      }),
    });

    await PUT(req, {}, storeId);

    // item-1 was processed: stock incremented, receivedQuantity updated
    expect(BatchService.addGenericBatch).toHaveBeenCalledWith(productId, 5, expect.anything());
    expect(prisma.purchaseOrderItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "item-1" },
        data: { receivedQuantity: { increment: 5 } },
      }),
    );

    // item-2 was NOT processed (no stock change, no receivedQuantity update)
    expect(prisma.purchaseOrderItem.update).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: "item-2" } }));

    // Crucially, status must remain "partially_received" so the receive button
    // stays visible for the user to record the future shipment of item-2.
    expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "partially_received" }),
      }),
    );
  });

  it("should close PO if closePo is true even if partial", async () => {
    const existingPO = {
      id: poId,
      status: "ordered",
      storeId: storeId,
      items: [{ id: "item-1", productId: productId, quantity: 10, receivedQuantity: 0, price: 1000, product: { name: "Test Product" } }],
      supplier: { id: "sup-1", name: "Supplier 1" },
      createdAt: new Date(),
      payments: [],
    };

    const updatedPO = {
      ...existingPO,
      status: "received",
      items: [{ ...existingPO.items[0], product: { name: "Test" } }],
      // Note: Updated PO mock should have supplier for response formatting
      supplier: { id: "sup-1", name: "Supplier 1" },
      createdAt: new Date(),
      estimatedDelivery: null,
      payments: [],
    };

    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValueOnce(existingPO).mockResolvedValueOnce(updatedPO);

    (prisma.product.update as jest.Mock).mockResolvedValue({ id: productId, name: "Test", purchase_price: 1000 });
    const req = new NextRequest(`http://localhost:3000/api/purchase-orders/${poId}`, {
      method: "PUT",
      body: JSON.stringify({
        items: [{ id: "item-1", receivedQuantity: 5 }],
        closePo: true,
      }),
    });

    await PUT(req, {}, storeId);

    expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "received" }),
      }),
    );
  });

  it("should NOT increment stock for normal updates", async () => {
    const existingPO = {
      id: poId,
      status: "draft",
      storeId: storeId,
      items: [],
      supplier: { id: "sup-1", name: "Supplier 1" },
      createdAt: new Date(),
      payments: [],
    };

    const updatedPO = {
      ...existingPO,
      status: "ordered",
      supplier: { id: "sup-1", name: "Supplier 1" },
      createdAt: new Date(),
      estimatedDelivery: null,
      payments: [],
    };

    (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValueOnce(existingPO).mockResolvedValueOnce(updatedPO);
    (prisma.purchaseOrder.update as jest.Mock).mockResolvedValue(updatedPO);

    const req = new NextRequest(`http://localhost:3000/api/purchase-orders/${poId}`, {
      method: "PUT",
      body: JSON.stringify({ status: "ordered" }),
    });

    await PUT(req, {}, storeId);

    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  describe("Price history logging on receive (uses PO price, not weighted average)", () => {
    it("logs the actual PO item price when it differs from the previous PO", async () => {
      const existingPO = {
        id: poId,
        poNumber: "PO-NEW",
        status: "ordered",
        storeId: storeId,
        paymentStatus: "UNPAID",
        amountPaid: 0,
        remainingAmount: 115000,
        totalAmount: 115000,
        dueDate: null,
        notes: null,
        items: [{ id: "item-1", productId: productId, quantity: 5, receivedQuantity: 0, price: 23000, unit: "pcs", product: { name: "Whiskas" } }],
        supplierId: "sup-1",
        supplier: { id: "sup-1", name: "Supplier 1", phone: null, address: null, email: null, code: "SUP-1" },
        createdAt: new Date("2026-06-02T00:00:00.000Z"),
        estimatedDelivery: null,
        payments: [],
      };

      const updatedPO = {
        ...existingPO,
        status: "partially_received",
        items: [{ ...existingPO.items[0], receivedQuantity: 5, product: { name: "Whiskas" } }],
        estimatedDelivery: null,
      };

      (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValueOnce(existingPO).mockResolvedValueOnce(updatedPO);
      // Refactor: prefetch uses findMany with id IN clause instead of findUnique.
      (prisma.product.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "prod-123", stock: 6, purchase_price: 22833.33, hpp_price: 22833.33, hppCalculationDetails: null, conversionTargetId: null, conversionRate: null }
      ]);
      (prisma.productBatch.findMany as jest.Mock).mockResolvedValueOnce([{ productId: "prod-123", stock: 6 }]);
      (prisma.productSupplier.findMany as jest.Mock).mockResolvedValueOnce([]);
      // Most recent prior PO item for this product: 22,000
      (prisma.purchaseOrderItem.findMany as jest.Mock).mockResolvedValueOnce([{ price: 22000, productId: "prod-123" }]);
      (prisma.productSupplier.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.purchaseOrderItem.update as jest.Mock).mockResolvedValue({});
      (prisma.purchaseOrder.update as jest.Mock).mockResolvedValue(updatedPO);

      const req = new NextRequest(`http://localhost:3000/api/purchase-orders/${poId}`, {
        method: "PUT",
        body: JSON.stringify({ items: [{ id: "item-1", receivedQuantity: 5 }], closePo: false }),
      });

      const response = await PUT(req, {}, storeId);
      expect(response.status).toBe(200);

      // Modal (product.purchase_price) update still uses the weighted average,
      // which is NOT the PO price.
      const productUpdateCall = (prisma.product.update as jest.Mock).mock.calls[0][0];
      expect(productUpdateCall.data.purchase_price).toBe(22909);

      // Price history must be logged with the actual PO price, not the weighted average.
      // oldPrice = previous PO item price (22.000), newPrice = current PO item price (23.000)
      expect(prisma.priceHistory.create).toHaveBeenCalledTimes(1);
      const historyCall = (prisma.priceHistory.create as jest.Mock).mock.calls[0][0];
      expect(historyCall.data.priceType).toBe("PURCHASE");
      expect(historyCall.data.source).toBe("SYSTEM_RECEIVE");
      expect(historyCall.data.referenceId).toBe(poId);
      expect(historyCall.data.newPrice).toBe(23000); // PO price, not weighted average
    });

    it("does NOT log price history when PO price is unchanged from previous PO", async () => {
      const existingPO = {
        id: poId,
        poNumber: "PO-SAME",
        status: "ordered",
        storeId: storeId,
        paymentStatus: "UNPAID",
        amountPaid: 0,
        remainingAmount: 100000,
        totalAmount: 100000,
        dueDate: null,
        notes: null,
        items: [{ id: "item-1", productId: productId, quantity: 5, receivedQuantity: 0, price: 20000, unit: "pcs", product: { name: "Product" } }],
        supplierId: "sup-1",
        supplier: { id: "sup-1", name: "Supplier 1", phone: null, address: null, email: null, code: "SUP-1" },
        createdAt: new Date("2026-06-02T00:00:00.000Z"),
        estimatedDelivery: null,
        payments: [],
      };
      const updatedPO = {
        ...existingPO,
        status: "received",
        items: [{ ...existingPO.items[0], receivedQuantity: 5, product: { name: "Product" } }],
        estimatedDelivery: null,
      };

      (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValueOnce(existingPO).mockResolvedValueOnce(updatedPO);
      // Refactor: prefetch uses findMany.
      (prisma.product.findMany as jest.Mock).mockResolvedValueOnce([
        { id: "prod-123", stock: 6, purchase_price: 20000, hpp_price: 20000, hppCalculationDetails: null, conversionTargetId: null, conversionRate: null }
      ]);
      (prisma.productBatch.findMany as jest.Mock).mockResolvedValueOnce([{ productId: "prod-123", stock: 6 }]);
      (prisma.productSupplier.findMany as jest.Mock).mockResolvedValueOnce([]);
      (prisma.purchaseOrderItem.findMany as jest.Mock).mockResolvedValueOnce([{ price: 20000, productId: "prod-123" }]);
      (prisma.productSupplier.findFirst as jest.Mock).mockResolvedValueOnce(null);
      (prisma.purchaseOrderItem.update as jest.Mock).mockResolvedValue({});
      (prisma.purchaseOrder.update as jest.Mock).mockResolvedValue(updatedPO);

      const req = new NextRequest(`http://localhost:3000/api/purchase-orders/${poId}`, {
        method: "PUT",
        body: JSON.stringify({ items: [{ id: "item-1", receivedQuantity: 5 }], closePo: true }),
      });
      const response = await PUT(req, {}, storeId);
      expect(response.status).toBe(200);
      expect(prisma.priceHistory.create).not.toHaveBeenCalled();
    });
  });

  describe("Guard Clause: storeId required for receive goods", () => {
    it("returns 500 when storeId is null on receive action", async () => {
      const existingPO = {
        id: poId,
        poNumber: "PO-001",
        status: "ordered",
        supplierId: "sup-1",
        items: [{ id: "item-1", productId, quantity: 10, receivedQuantity: 0, price: 1000 }],
        createdAt: new Date(),
      };
      (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValueOnce(existingPO);

      const req = new NextRequest(`http://localhost:3000/api/purchase-orders/${poId}`, {
        method: "PUT",
        body: JSON.stringify({ items: [{ id: "item-1", receivedQuantity: 5 }] }),
      });

      // Pass storeId=null. Guard clause in handleReceiveGoods MUST throw before
      // calling computeReceivePlan with `storeId!` (which would silently pass
      // undefined to Prisma and cause a runtime error on storeId FK constraints).
      const response = await PUT(req, {}, null);

      expect(response.status).toBeGreaterThanOrEqual(500);
      // computeReceivePlan should NOT be reached.
      // Transaction should NOT open either (guard throws before $transaction).
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("returns 500 with descriptive error when storeId is undefined on receive action", async () => {
      const existingPO = {
        id: poId,
        poNumber: "PO-001",
        status: "ordered",
        supplierId: "sup-1",
        items: [{ id: "item-1", productId, quantity: 10, receivedQuantity: 0, price: 1000 }],
        createdAt: new Date(),
      };
      (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValueOnce(existingPO);

      const req = new NextRequest(`http://localhost:3000/api/purchase-orders/${poId}`, {
        method: "PUT",
        body: JSON.stringify({ items: [{ id: "item-1", receivedQuantity: 5 }] }),
      });

      const response = await PUT(req, {}, undefined as unknown as string);

      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("Guard Clause: storeId required for retroactive price update", () => {
    const retroPoId = "po-retro-1";
    const retroProductId = "prod-retro-1";

    it("returns 500 and skips $transaction when storeId is null on retroactive update", async () => {
      const existingPO = {
        id: retroPoId,
        poNumber: "PO-RETRO-001",
        status: "ordered",
        supplierId: "sup-1",
        storeId: "store-123",
        items: [
          {
            id: "item-1",
            productId: retroProductId,
            quantity: 10,
            receivedQuantity: 0,
            price: 10000, // OLD price (will be updated retroactively)
            product: { name: "Retro Product" },
          },
        ],
        createdAt: new Date(),
        payments: [],
      };

      (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValueOnce(existingPO);

      const req = new NextRequest(`http://localhost:3000/api/purchase-orders/${retroPoId}`, {
        method: "PUT",
        body: JSON.stringify({
          action: "update_prices",
          items: [{ id: "item-1", price: 12000 }], // NEW price differs → triggers retroactive flow
        }),
      });

      const txCallCountBefore = (prisma.$transaction as jest.Mock).mock.calls.length;

      const response = await PUT(req, {}, null);

      expect(response.status).toBeGreaterThanOrEqual(500);

      // Guard clause MUST throw BEFORE prisma.$transaction is called in handleRetroactivePriceUpdate.
      // Line 889 (findFirst with storeId!) is OUTSIDE transaction so it can be called once,
      // but the retroactive $transaction (which mutates priceHistory) MUST NOT be opened.
      const txCallCountAfter = (prisma.$transaction as jest.Mock).mock.calls.length;
      expect(txCallCountAfter).toBe(txCallCountBefore); // no NEW $transaction from retroactive flow
    });

    it("returns 500 and skips $transaction when storeId is undefined on retroactive update", async () => {
      const existingPO = {
        id: retroPoId,
        poNumber: "PO-RETRO-002",
        status: "ordered",
        supplierId: "sup-1",
        storeId: "store-123",
        items: [
          {
            id: "item-2",
            productId: retroProductId,
            quantity: 5,
            receivedQuantity: 0,
            price: 15000,
            product: { name: "Retro Product 2" },
          },
        ],
        createdAt: new Date(),
        payments: [],
      };

      (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValueOnce(existingPO);

      const req = new NextRequest(`http://localhost:3000/api/purchase-orders/${retroPoId}`, {
        method: "PUT",
        body: JSON.stringify({
          action: "update_prices",
          items: [{ id: "item-2", price: 18000 }],
        }),
      });

      const txCallCountBefore = (prisma.$transaction as jest.Mock).mock.calls.length;

      const response = await PUT(req, {}, undefined as unknown as string);

      expect(response.status).toBeGreaterThanOrEqual(500);
      const txCallCountAfter = (prisma.$transaction as jest.Mock).mock.calls.length;
      expect(txCallCountAfter).toBe(txCallCountBefore);
    });
  });
});