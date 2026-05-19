/**
 * @jest-environment node
 */

// 1. Mock Prisma with jest-mock-extended for full deep typing
jest.mock("@/lib/prisma", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockDeep } = require("jest-mock-extended");
  return {
    __esModule: true,
    default: mockDeep(),
  };
});

// 2. Bypass auth: forward storeId as 'store-1' to the handler
jest.mock("@/lib/api-middleware", () => ({
  withAuth: (handler: any) => {
    return async (req: any, ...args: any[]) => {
      const session = { user: { id: "user-1", storeId: "store-1" } };
      const storeId = "store-1";
      return handler(req, session, storeId, ...args);
    };
  },
}));

import { POST } from "../apply/route";
import prisma from "@/lib/prisma";
import { NextRequest } from "next/server";
import { DeepMockProxy } from "jest-mock-extended";
import { PrismaClient } from "@prisma/client";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const createPostRequest = (body: unknown) =>
  new NextRequest(
    "http://localhost:3000/api/dashboard/price-recommendations/apply",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

describe("POST /api/dashboard/price-recommendations/apply", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default $transaction implementation: invoke the callback with the same
    // mocked client so each tx.<table>.<op> resolves to the configured mock.
    prismaMock.$transaction.mockImplementation(
      async (cb: any) => cb(prismaMock),
    );
  });

  describe("200 happy path", () => {
    it("updates product.price ONLY (never min_selling_price or hppCalculationDetails) and writes a PriceHistory row", async () => {
      prismaMock.product.findFirst.mockResolvedValueOnce({
        id: "p1",
        name: "X",
        price: 11000,
        min_selling_price: 10000,
      } as any);

      prismaMock.product.update.mockResolvedValueOnce({
        id: "p1",
        name: "X",
        price: 12000,
        min_selling_price: 10000,
      } as any);

      prismaMock.priceHistory.create.mockResolvedValueOnce({} as any);

      const req = createPostRequest({ productId: "p1", price: 12000 });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({
        id: "p1",
        name: "X",
        price: 12000,
        min_selling_price: 10000,
      });

      // CRITICAL ASSERTION 1: product.update called with data containing the price
      expect(prismaMock.product.update).toHaveBeenCalledTimes(1);
      expect(prismaMock.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "p1" },
          data: { price: 12000 },
        }),
      );

      // CRITICAL ASSERTION 2: data must contain ONLY { price }, no other keys
      const updateCall = prismaMock.product.update.mock.calls[0][0] as any;
      expect(updateCall.data).toEqual({ price: 12000 });
      expect(Object.keys(updateCall.data)).toEqual(["price"]);
      expect(updateCall.data).not.toHaveProperty("min_selling_price");
      expect(updateCall.data).not.toHaveProperty("hppCalculationDetails");

      // PriceHistory row written with the documented fields
      expect(prismaMock.priceHistory.create).toHaveBeenCalledTimes(1);
      expect(prismaMock.priceHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            productId: "p1",
            storeId: "store-1",
            priceType: "SELLING",
            source: "MANUAL_EDIT",
            oldPrice: 11000,
            newPrice: 12000,
          }),
        }),
      );

      // Transaction was used
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it("does NOT write a PriceHistory row when the price is unchanged", async () => {
      prismaMock.product.findFirst.mockResolvedValueOnce({
        id: "p1",
        name: "X",
        price: 12000,
        min_selling_price: 10000,
      } as any);

      prismaMock.product.update.mockResolvedValueOnce({
        id: "p1",
        name: "X",
        price: 12000,
        min_selling_price: 10000,
      } as any);

      const req = createPostRequest({ productId: "p1", price: 12000 });
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(prismaMock.product.update).toHaveBeenCalledTimes(1);
      expect(prismaMock.priceHistory.create).not.toHaveBeenCalled();
    });
  });

  describe("400 invalid body", () => {
    it("returns INVALID_BODY when payload is missing required fields", async () => {
      const req = createPostRequest({ productId: "p1" });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.code).toBe("INVALID_BODY");
      expect(prismaMock.product.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.product.update).not.toHaveBeenCalled();
      expect(prismaMock.priceHistory.create).not.toHaveBeenCalled();
    });

    it("returns INVALID_BODY when payload is empty", async () => {
      const req = createPostRequest({});
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.code).toBe("INVALID_BODY");
    });

    it("returns NOT_MULTIPLE_OF_50 when price is not a multiple of 50", async () => {
      const req = createPostRequest({ productId: "p1", price: 12345 });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.code).toBe("NOT_MULTIPLE_OF_50");
      expect(prismaMock.product.findFirst).not.toHaveBeenCalled();
      expect(prismaMock.product.update).not.toHaveBeenCalled();
    });
  });

  describe("400 below minimum", () => {
    it("returns BELOW_MIN_SELLING_PRICE when price is below product.min_selling_price", async () => {
      prismaMock.product.findFirst.mockResolvedValueOnce({
        id: "p1",
        name: "X",
        price: 11000,
        min_selling_price: 10000,
      } as any);

      const req = createPostRequest({ productId: "p1", price: 5000 });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.code).toBe("BELOW_MIN_SELLING_PRICE");
      expect(prismaMock.product.update).not.toHaveBeenCalled();
      expect(prismaMock.priceHistory.create).not.toHaveBeenCalled();
    });
  });

  describe("404 wrong store / product not found", () => {
    it("returns PRODUCT_NOT_FOUND when the product lookup returns null", async () => {
      prismaMock.product.findFirst.mockResolvedValueOnce(null);

      const req = createPostRequest({ productId: "p-unknown", price: 12000 });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.code).toBe("PRODUCT_NOT_FOUND");
      expect(prismaMock.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "p-unknown",
            storeId: "store-1",
            isDeleted: false,
          }),
        }),
      );
      expect(prismaMock.product.update).not.toHaveBeenCalled();
    });
  });

  describe("500 on transaction rollback", () => {
    it("returns INTERNAL when the transaction throws", async () => {
      prismaMock.product.findFirst.mockResolvedValueOnce({
        id: "p1",
        name: "X",
        price: 11000,
        min_selling_price: 10000,
      } as any);

      // Simulate Postgres rolling back the transaction
      prismaMock.$transaction.mockImplementationOnce(async () => {
        throw new Error("transaction rolled back");
      });

      // Silence the console.error from the route's catch block
      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      const req = createPostRequest({ productId: "p1", price: 12000 });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.code).toBe("INTERNAL");

      errorSpy.mockRestore();
    });
  });
});
