// 1. Mock Prisma
jest.mock("@/lib/prisma", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockDeep } = require("jest-mock-extended");
  return {
    __esModule: true,
    default: mockDeep(),
  };
});

// 2. Mock Auth
const mockSession = {
  user: {
    name: "Test User",
    email: "test@example.com",
    role: "OWNER",
    storeId: "store-123",
  },
};

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(() => Promise.resolve(mockSession)),
}));

// 3. Mock Notification Service
const mockCheckLowStockRequest = jest.fn();
jest.mock("@/lib/notificationService", () => ({
  checkLowStockProducts: (...args: any[]) => mockCheckLowStockRequest(...args),
}));

import { PUT, DELETE } from "./route";
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { DeepMockProxy } from "jest-mock-extended";
import { PrismaClient } from "@prisma/client";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe("products/[id] API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("PUT /api/products/[id]", () => {
    const validUpdateData = {
      name: "Updated Product",
      price: 15000,
      stock: 5,
      category: "Updated Category",
      unit: "kg",
    };

    it("should update product successfully", async () => {
      // Mock existing product
      prismaMock.product.findFirst.mockResolvedValueOnce({
        id: "prod-1",
        storeId: "store-123",
        barcode: "existing-barcode",
      } as any);

      // Mock update
      prismaMock.product.update.mockResolvedValue({
        id: "prod-1",
        ...validUpdateData,
        storeId: "store-123",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/products/prod-1", {
        method: "PUT",
        body: JSON.stringify(validUpdateData),
      });

      const res = await PUT(req);
      await res.json();

      expect(res.status).toBe(200);
      expect(prismaMock.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "prod-1", storeId: "store-123" },
          data: expect.objectContaining({ name: "Updated Product" }),
        }),
      );
      expect(mockCheckLowStockRequest).toHaveBeenCalledWith("store-123");
    });

    it("should return 404 if product not found", async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);

      const req = new NextRequest(
        "http://localhost:3000/api/products/non-existent",
        {
          method: "PUT",
          body: JSON.stringify(validUpdateData),
        },
      );

      const res = await PUT(req);

      expect(res.status).toBe(404);
    });

    it("should return 400 if validation fails", async () => {
      // Mock existing product
      prismaMock.product.findFirst.mockResolvedValueOnce({
        id: "prod-1",
        storeId: "store-123",
      } as any);

      const invalidData = {
        name: "",
        price: -100,
      };

      const req = new NextRequest("http://localhost:3000/api/products/prod-1", {
        method: "PUT",
        body: JSON.stringify(invalidData),
      });

      const res = await PUT(req);
      const data = await res.json();

      expect(data.error).toBe("Validation failed");
    });

    it("should cascade supplier update to child product", async () => {
      // Mock existing product with conversion target (Parent Product)
      prismaMock.product.findFirst.mockResolvedValueOnce({
        id: "parent-prod",
        storeId: "store-123",
        conversionTargetId: "child-prod",
        conversionRate: 10,
        supplierId: "old-supplier",
      } as any);

      // Mock update of parent product
      prismaMock.product.update.mockResolvedValueOnce({
        id: "parent-prod",
        storeId: "store-123",
        conversionTargetId: "child-prod",
        conversionRate: 10,
        supplierId: "new-supplier",
      } as any);

      // Mock update of child product (Cascading update)
      // This expectation is what we want to verify
      prismaMock.product.update.mockResolvedValueOnce({
        id: "child-prod",
        supplierId: "new-supplier",
      } as any);

      // Mock supplier existence check
      prismaMock.supplier.findFirst.mockResolvedValueOnce({
        id: "new-supplier",
        name: "New Supplier",
        storeId: "store-123",
      } as any);

      const updateData = {
        supplierId: "new-supplier",
      };

      const req = new NextRequest(
        "http://localhost:3000/api/products/parent-prod",
        {
          method: "PUT",
          body: JSON.stringify(updateData),
        },
      );

      const res = await PUT(req);
      await res.json();

      expect(res.status).toBe(200);

      // Verify that parent update was called
      expect(prismaMock.product.update).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({ id: "parent-prod" }),
          data: expect.objectContaining({
            supplier: { connect: { id: "new-supplier" } },
          }),
        }),
      );

      // Verify that child update was called with new supplier
      // This will FAIL currently because the code doesn't do this
      expect(prismaMock.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "child-prod" },
          data: expect.objectContaining({ supplierId: "new-supplier" }), // Or however we implement it
        }),
      );
    });
  });

  describe("DELETE /api/products/[id]", () => {
    it("should soft delete product successfully", async () => {
      prismaMock.product.findFirst.mockResolvedValue({
        id: "prod-1",
        storeId: "store-123",
      } as any);

      prismaMock.product.update.mockResolvedValue({
        id: "prod-1",
        isDeleted: true,
      } as any);

      const req = new NextRequest("http://localhost:3000/api/products/prod-1", {
        method: "DELETE",
      });

      const res = await DELETE(req);
      await res.json();

      expect(res.status).toBe(200);
      expect(prismaMock.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "prod-1" },
          data: { isDeleted: true },
        }),
      );
    });

    it("should return 404 if product not found", async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);

      const req = new NextRequest(
        "http://localhost:3000/api/products/non-existent",
        {
          method: "DELETE",
        },
      );

      const res = await DELETE(req);

      expect(res.status).toBe(404);
    });
  });
});
