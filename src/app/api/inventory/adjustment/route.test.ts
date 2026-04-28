import { NextRequest } from "next/server";
import { POST } from "./route";
import prisma from "@/lib/prisma";
import { BatchService } from "@/services/batch.service";

jest.mock("@/lib/auth", () => ({
  auth: jest.fn().mockResolvedValue({
    user: {
      id: "user-1",
    },
  }),
}));

jest.mock("@/lib/prisma", () => {
  interface MockPrismaClient {
    product: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    productBatch: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    stockAdjustment: {
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  }

  const client: MockPrismaClient = {
    product: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    productBatch: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    stockAdjustment: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  client.$transaction.mockImplementation(async (callback: (tx: MockPrismaClient) => Promise<unknown>) => callback(client));

  return {
    __esModule: true,
    default: client,
  };
});

jest.mock("@/services/notification.service", () => ({
  NotificationService: {
    checkExpiredProducts: jest.fn(),
    checkLowStockProducts: jest.fn(),
  },
}));

jest.mock("@/services/batch.service", () => ({
  BatchService: {
    addGenericBatch: jest.fn(),
  },
}));

describe("POST /api/inventory/adjustment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a generic batch for positive adjustments without batchId", async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue({
      id: "prod-1",
      storeId: "store-1",
      stock: 3.2,
      purchase_price: 10000,
    });
    (prisma.product.findUnique as jest.Mock).mockResolvedValue({
      id: "prod-1",
      name: "Retail Product",
      stock: 3.2,
    });
    (prisma.productBatch.findMany as jest.Mock).mockResolvedValue([]);
    (BatchService.addGenericBatch as jest.Mock).mockResolvedValue({ id: "batch-repair" });
    (prisma.stockAdjustment.create as jest.Mock).mockResolvedValue({ id: "adj-1" });

    const req = new NextRequest("http://localhost:3000/api/inventory/adjustment", {
      method: "POST",
      body: JSON.stringify({
        storeId: "store-1",
        productId: "prod-1",
        quantity: 3,
        type: "SYSTEM_ERROR",
        reason: "Stok fisik ada",
      }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(BatchService.addGenericBatch).toHaveBeenCalledWith("prod-1", 3, expect.anything());
    expect(prisma.stockAdjustment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          batchId: "batch-repair",
        }),
      }),
    );
    expect(data.success).toBe(true);
  });

  it("rejects stock deduction when product stock is already mismatched against batches", async () => {
    (prisma.product.findFirst as jest.Mock).mockResolvedValue({
      id: "prod-1",
      storeId: "store-1",
      stock: 5,
      purchase_price: 10000,
    });
    (prisma.product.findUnique as jest.Mock).mockResolvedValue({
      id: "prod-1",
      name: "Retail Product",
      stock: 5,
    });
    (prisma.productBatch.findMany as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest("http://localhost:3000/api/inventory/adjustment", {
      method: "POST",
      body: JSON.stringify({
        storeId: "store-1",
        productId: "prod-1",
        quantity: -2,
        type: "CORRECTION",
        reason: "Kurangi stok",
      }),
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain("Stock mismatch detected");
  });
});
