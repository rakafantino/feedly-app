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
    product: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    purchaseOrderItem: { update: jest.fn() },
    productBatch: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    priceHistory: { create: jest.fn() },
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
    jest.clearAllMocks();
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
});
