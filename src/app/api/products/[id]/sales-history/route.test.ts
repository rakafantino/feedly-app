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
    transactionItem: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe("GET /api/products/[id]/sales-history", () => {
  const prismaMock = prisma as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockResolvedValue({
      user: { id: "user-1", storeId: "store-1", role: "OWNER" },
    });
    (validateStoreAccess as jest.Mock).mockResolvedValue({ valid: true, role: "OWNER" });
    (hasPermission as jest.Mock).mockReturnValue(true);
  });

  it("returns completed sales history scoped to the current store", async () => {
    prismaMock.product.findFirst.mockResolvedValue({
      id: "prod-1",
      storeId: "store-1",
    });
    prismaMock.transactionItem.count.mockResolvedValue(2);
    prismaMock.transactionItem.findMany.mockResolvedValue([
      {
        id: "item-1",
        quantity: 2,
        price: 10000,
        cost_price: 6000,
        transaction: {
          id: "tx-1",
          invoiceNumber: "INV-001",
          createdAt: new Date("2026-05-15T03:00:00.000Z"),
          paymentMethod: "CASH",
          paymentStatus: "PAID",
          customer: { name: "Budi" },
        },
      },
      {
        id: "item-2",
        quantity: 3,
        price: 12000,
        cost_price: 7000,
        transaction: {
          id: "tx-2",
          invoiceNumber: "INV-002",
          createdAt: new Date("2026-05-14T03:00:00.000Z"),
          paymentMethod: "TRANSFER",
          paymentStatus: "PAID",
          customer: null,
        },
      },
    ]);

    const req = new NextRequest("http://localhost:3000/api/products/prod-1/sales-history");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(prismaMock.product.findFirst).toHaveBeenCalledWith({
      where: { id: "prod-1", isDeleted: false, storeId: "store-1" },
      select: { id: true },
    });
    expect(prismaMock.transactionItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productId: "prod-1",
          transaction: {
            storeId: "store-1",
            status: "COMPLETED",
          },
        },
      }),
    );
    expect(data.history).toEqual([
      expect.objectContaining({
        id: "item-1",
        invoiceNumber: "INV-001",
        customerName: "Budi",
        quantity: 2,
        unitPrice: 10000,
        lineTotal: 20000,
        profit: 8000,
      }),
      expect.objectContaining({
        id: "item-2",
        customerName: "Guest",
        lineTotal: 36000,
        profit: 15000,
      }),
    ]);
    expect(data.summary).toEqual({
      totalQuantity: 5,
      totalRevenue: 56000,
      totalCost: 33000,
      totalProfit: 23000,
      averageSellingPrice: 11200,
      totalTransactions: 2,
    });
  });

  it("returns 404 when the product is not in the current store", async () => {
    prismaMock.product.findFirst.mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/products/prod-unknown/sales-history");
    const res = await GET(req);

    expect(res.status).toBe(404);
    expect(prismaMock.transactionItem.findMany).not.toHaveBeenCalled();
  });

  it("supports fetching the complete product sales history with limit=all", async () => {
    prismaMock.product.findFirst.mockResolvedValue({
      id: "prod-1",
      storeId: "store-1",
    });
    prismaMock.transactionItem.count.mockResolvedValue(75);
    prismaMock.transactionItem.findMany.mockResolvedValue([]);

    const req = new NextRequest("http://localhost:3000/api/products/prod-1/sales-history?limit=all");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(prismaMock.transactionItem.findMany).toHaveBeenCalledWith(
      expect.not.objectContaining({
        skip: expect.any(Number),
        take: expect.any(Number),
      }),
    );
    expect(data.pagination.limit).toBe(75);
    expect(data.pagination.totalPages).toBe(1);
  });

  it("paginates product sales history", async () => {
    prismaMock.product.findFirst.mockResolvedValue({
      id: "prod-1",
      storeId: "store-1",
    });
    prismaMock.transactionItem.count.mockResolvedValue(24);
    prismaMock.transactionItem.findMany.mockResolvedValue([]);

    const req = new NextRequest("http://localhost:3000/api/products/prod-1/sales-history?page=2&limit=10");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(prismaMock.transactionItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      }),
    );
    expect(data.pagination).toEqual({
      total: 24,
      page: 2,
      limit: 10,
      totalPages: 3,
    });
  });

  it("keeps the summary based on all matching sales, not only the current page", async () => {
    prismaMock.product.findFirst.mockResolvedValue({
      id: "prod-1",
      storeId: "store-1",
    });
    prismaMock.transactionItem.count.mockResolvedValue(2);
    prismaMock.transactionItem.findMany
      .mockResolvedValueOnce([
        {
          id: "page-item",
          quantity: 1,
          price: 10000,
          cost_price: 7000,
          transaction: {
            id: "tx-page",
            invoiceNumber: "INV-PAGE",
            createdAt: new Date("2026-05-16T03:00:00.000Z"),
            paymentMethod: "CASH",
            paymentStatus: "PAID",
            customer: null,
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "summary-item-1",
          quantity: 1,
          price: 10000,
          cost_price: 7000,
          transactionId: "tx-1",
          product: null,
        },
        {
          id: "summary-item-2",
          quantity: 4,
          price: 12000,
          cost_price: 8000,
          transactionId: "tx-2",
          product: null,
        },
      ]);

    const req = new NextRequest("http://localhost:3000/api/products/prod-1/sales-history?page=1&limit=1");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.history).toHaveLength(1);
    expect(data.summary).toEqual({
      totalQuantity: 5,
      totalRevenue: 58000,
      totalCost: 39000,
      totalProfit: 19000,
      averageSellingPrice: 11600,
      totalTransactions: 2,
    });
  });
});
