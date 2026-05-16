/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { GET } from "./route";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { validateStoreAccess, hasPermission } from "@/lib/store-access";

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/store-access", () => ({
  validateStoreAccess: jest.fn(),
  hasPermission: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    $executeRaw: jest.fn(),
  },
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    product: {
      findFirst: jest.fn(),
    },
    purchaseOrderItem: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe("GET /api/products/[id]/purchase-history", () => {
  const prismaMock = prisma as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "user-1", storeId: "store-1", role: "OWNER" },
    });
    (validateStoreAccess as jest.Mock).mockResolvedValue({ valid: true, role: "OWNER" });
    (hasPermission as jest.Mock).mockReturnValue(true);
  });

  it("returns product PO history scoped to the current store", async () => {
    prismaMock.product.findFirst.mockResolvedValue({
      id: "prod-1",
      storeId: "store-1",
    });
    prismaMock.purchaseOrderItem.count.mockResolvedValue(1);
    prismaMock.purchaseOrderItem.findMany.mockResolvedValue([
      {
        id: "poi-1",
        quantity: 12,
        receivedQuantity: 8,
        unit: "pcs",
        price: 5000,
        purchaseOrder: {
          id: "po-1",
          poNumber: "PO-001",
          status: "partially_received",
          paymentStatus: "PARTIAL",
          createdAt: new Date("2026-05-10T03:00:00.000Z"),
          estimatedDelivery: new Date("2026-05-15T03:00:00.000Z"),
          supplier: { name: "Supplier A" },
        },
      },
    ]);

    const req = new NextRequest("http://localhost:3000/api/products/prod-1/purchase-history");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(prismaMock.product.findFirst).toHaveBeenCalledWith({
      where: { id: "prod-1", isDeleted: false, storeId: "store-1" },
      select: { id: true },
    });
    expect(prismaMock.purchaseOrderItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productId: "prod-1",
          purchaseOrder: {
            storeId: "store-1",
          },
        },
      }),
    );
    expect(data.history).toEqual([
      expect.objectContaining({
        id: "poi-1",
        purchaseOrderId: "po-1",
        poNumber: "PO-001",
        supplierName: "Supplier A",
        quantityOrdered: 12,
        receivedQuantity: 8,
        unit: "pcs",
        unitPrice: 5000,
        lineTotal: 60000,
      }),
    ]);
    expect(data.summary).toEqual({
      totalOrdered: 12,
      totalReceived: 8,
      totalAmount: 60000,
      totalPurchaseOrders: 1,
    });
  });

  it("paginates product PO history", async () => {
    prismaMock.product.findFirst.mockResolvedValue({
      id: "prod-1",
      storeId: "store-1",
    });
    prismaMock.purchaseOrderItem.count.mockResolvedValue(21);
    prismaMock.purchaseOrderItem.findMany.mockResolvedValue([]);

    const req = new NextRequest("http://localhost:3000/api/products/prod-1/purchase-history?page=3&limit=10");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(prismaMock.purchaseOrderItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
      }),
    );
    expect(data.pagination).toEqual({
      total: 21,
      page: 3,
      limit: 10,
      totalPages: 3,
    });
  });

  it("returns 404 when the product is not in the current store", async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/products/prod-unknown/purchase-history");
    const res = await GET(req);

    expect(res.status).toBe(404);
    expect(prismaMock.purchaseOrderItem.findMany).not.toHaveBeenCalled();
  });

  it("keeps the summary based on all matching PO items, not only the current page", async () => {
    prismaMock.product.findFirst.mockResolvedValue({
      id: "prod-1",
      storeId: "store-1",
    });
    prismaMock.purchaseOrderItem.count.mockResolvedValue(2);
    prismaMock.purchaseOrderItem.findMany
      .mockResolvedValueOnce([
        {
          id: "page-poi",
          quantity: 2,
          receivedQuantity: 1,
          unit: "pcs",
          price: 5000,
          purchaseOrder: {
            id: "po-page",
            poNumber: "PO-PAGE",
            status: "ordered",
            paymentStatus: "UNPAID",
            createdAt: new Date("2026-05-16T03:00:00.000Z"),
            estimatedDelivery: null,
            supplier: { name: "Supplier A" },
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "summary-poi-1",
          quantity: 2,
          receivedQuantity: 1,
          price: 5000,
          purchaseOrderId: "po-1",
        },
        {
          id: "summary-poi-2",
          quantity: 8,
          receivedQuantity: 8,
          price: 7000,
          purchaseOrderId: "po-2",
        },
      ]);

    const req = new NextRequest("http://localhost:3000/api/products/prod-1/purchase-history?page=1&limit=1");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.history).toHaveLength(1);
    expect(data.summary).toEqual({
      totalOrdered: 10,
      totalReceived: 9,
      totalAmount: 66000,
      totalPurchaseOrders: 2,
    });
  });
});
