/**
 * @jest-environment node
 *
 * Integration tests for POST /api/dashboard/price-recommendations/custom.
 *
 * Validates the contract documented in design.md:
 *   - tx.product.update is called with ONLY `price` and `hppCalculationDetails`
 *     (NEVER `min_selling_price`) — Requirements 3.2, 4.6, 4.7.
 *   - The merged `hppCalculationDetails` payload preserves `costs` and
 *     `safetyMargin` while overwriting `retailMargin` (rounded to 2 decimals)
 *     — Requirements 3.2, 3.3.
 *   - Error responses match the API error table for below-min, not-multiple-of-50,
 *     unavailable min, wrong-store, and tx-rollback cases — Requirements 3.5, 3.7,
 *     4.6, 4.8.
 *
 * Prisma is mocked via `jest-mock-extended`; no real database I/O occurs.
 */

// 1. Mock Prisma with jest-mock-extended (mockDeep so $transaction is mockable)
import { mockDeep } from 'jest-mock-extended';
jest.mock("@/lib/prisma", () => {
  return {
    __esModule: true,
    default: mockDeep(),
  };
});

// 2. Mock api-middleware so withAuth becomes a passthrough that supplies a
//    deterministic session and storeId (mirroring the pattern in route.test.ts).
jest.mock("@/lib/api-middleware", () => ({

  withAuth: (handler: any) => {
  
    return async (req: any, ...args: any[]) => {
      const session = { user: { id: "user-1" } };
      const storeId = "store-1";
      return handler(req, session, storeId, ...args);
    };
  },
}));

import { POST } from "../custom/route";
import prisma from "@/lib/prisma";
import { NextRequest } from "next/server";
import { DeepMockProxy } from "jest-mock-extended";
import { PrismaClient } from "@prisma/client";

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const createRequest = (body: unknown) =>
  new NextRequest(
    "http://localhost:3000/api/dashboard/price-recommendations/custom",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

describe("POST /api/dashboard/price-recommendations/custom", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default $transaction implementation: invoke the callback with the
    // mocked client, mirroring how Prisma actually executes interactive
    // transactions. Individual tests can override this for rollback cases.
    prismaMock.$transaction.mockImplementation(
    
      (callback: any) => callback(prismaMock),
    );
    // Silence the route's `console.error` calls; we don't want noisy output
    // for the deliberately-failing rollback case.
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("200: returns updated product with retailMargin rounded; updates only price + hppCalculationDetails (preserves costs + safetyMargin); inserts PriceHistory", async () => {
    // Existing product owns rich hppCalculationDetails; the merge MUST keep
    // `costs` and `safetyMargin` intact while overwriting `retailMargin`.
    prismaMock.product.findFirst.mockResolvedValueOnce({
      id: "p1",
      name: "X",
      price: 11000,
      min_selling_price: 10000,
      hppCalculationDetails: {
        costs: [{ name: "a", amount: 100 }],
        safetyMargin: "5",
        retailMargin: 10,
      },
    
    } as any);

    prismaMock.product.update.mockResolvedValueOnce({
      id: "p1",
      name: "X",
      price: 12500,
      min_selling_price: 10000,
    
    } as any);

    // delta = 2500, margin = (2500 / 10000) * 100 = 25.00
    const req = createRequest({ productId: "p1", customPrice: 12500 });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      id: "p1",
      name: "X",
      price: 12500,
      min_selling_price: 10000,
      retailMargin: 25,
    });

    // CRITICAL CONTRACT: product.update payload must contain ONLY `price` and
    // `hppCalculationDetails`. min_selling_price MUST NEVER appear here.
    expect(prismaMock.product.update).toHaveBeenCalledTimes(1);
    const updateCall = prismaMock.product.update.mock.calls[0][0];

    expect(updateCall.where).toEqual({ id: "p1", storeId: "store-1" });
    expect(updateCall.data).toEqual({
      price: 12500,
      hppCalculationDetails: {
        costs: [{ name: "a", amount: 100 }],
        safetyMargin: "5",
        retailMargin: 25,
      },
    });

    // Belt-and-braces: verify min_selling_price is not a key in the update data.
    expect(Object.keys(updateCall.data as object)).toEqual(
      expect.arrayContaining(["price", "hppCalculationDetails"]),
    );
    expect(Object.keys(updateCall.data as object)).not.toContain(
      "min_selling_price",
    );

    // Snapshot the merged hppCalculationDetails to lock in the preservation
    // contract for `costs` + `safetyMargin` and the overwrite of `retailMargin`.
    expect(
      (updateCall.data as { hppCalculationDetails: unknown })
        .hppCalculationDetails,
    ).toMatchSnapshot("merged hppCalculationDetails");

    // PriceHistory row inserted because oldPrice (11000) !== customPrice (12500).
    expect(prismaMock.priceHistory.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.priceHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId: "p1",
          storeId: "store-1",
          priceType: "SELLING",
          source: "MANUAL_EDIT",
          oldPrice: 11000,
          newPrice: 12500,
        }),
      }),
    );
  });

  it("400 BELOW_MIN_SELLING_PRICE: customPrice below product min_selling_price", async () => {
    prismaMock.product.findFirst.mockResolvedValueOnce({
      id: "p1",
      name: "X",
      price: 11000,
      min_selling_price: 10000,
      hppCalculationDetails: null,
    
    } as any);

    // 5000 is a valid multiple of 50 but is below min (10000).
    const req = createRequest({ productId: "p1", customPrice: 5000 });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.code).toBe("BELOW_MIN_SELLING_PRICE");
    expect(prismaMock.product.update).not.toHaveBeenCalled();
    expect(prismaMock.priceHistory.create).not.toHaveBeenCalled();
  });

  it("400 NOT_MULTIPLE_OF_50: customPrice is not a multiple of 50", async () => {
    // Schema-level rejection happens before the product lookup.
    const req = createRequest({ productId: "p1", customPrice: 12345 });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.code).toBe("NOT_MULTIPLE_OF_50");
    expect(prismaMock.product.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.product.update).not.toHaveBeenCalled();
  });

  it("400 MIN_SELLING_PRICE_UNAVAILABLE: product has null min_selling_price", async () => {
    prismaMock.product.findFirst.mockResolvedValueOnce({
      id: "p1",
      name: "X",
      price: 11000,
      min_selling_price: null,
      hppCalculationDetails: null,
    
    } as any);

    const req = createRequest({ productId: "p1", customPrice: 12500 });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.code).toBe("MIN_SELLING_PRICE_UNAVAILABLE");
    expect(prismaMock.product.update).not.toHaveBeenCalled();
  });

  it("404 PRODUCT_NOT_FOUND: findFirst returns null (wrong store or unknown id)", async () => {
    prismaMock.product.findFirst.mockResolvedValueOnce(null);

    const req = createRequest({ productId: "missing", customPrice: 12500 });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.code).toBe("PRODUCT_NOT_FOUND");
    expect(prismaMock.product.update).not.toHaveBeenCalled();
  });

  it("500 INTERNAL: $transaction rolls back / throws", async () => {
    prismaMock.product.findFirst.mockResolvedValueOnce({
      id: "p1",
      name: "X",
      price: 11000,
      min_selling_price: 10000,
      hppCalculationDetails: null,
    
    } as any);

    // Simulate Postgres rolling back the interactive transaction.
    prismaMock.$transaction.mockImplementationOnce(async () => {
      throw new Error("simulated rollback");
    });

    const req = createRequest({ productId: "p1", customPrice: 12500 });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.code).toBe("INTERNAL");
  });

  it("hppCalculationDetails is null on the existing product → update payload contains only retailMargin", async () => {
    prismaMock.product.findFirst.mockResolvedValueOnce({
      id: "p1",
      name: "X",
      price: 11000,
      min_selling_price: 10000,
      hppCalculationDetails: null,
    
    } as any);

    prismaMock.product.update.mockResolvedValueOnce({
      id: "p1",
      name: "X",
      price: 12500,
      min_selling_price: 10000,
    
    } as any);

    const req = createRequest({ productId: "p1", customPrice: 12500 });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.retailMargin).toBe(25);

    expect(prismaMock.product.update).toHaveBeenCalledTimes(1);
    const updateCall = prismaMock.product.update.mock.calls[0][0];
    expect(updateCall.data).toEqual({
      price: 12500,
      hppCalculationDetails: { retailMargin: 25 },
    });
    expect(Object.keys(updateCall.data as object)).not.toContain(
      "min_selling_price",
    );
  });

  it("does NOT insert PriceHistory when customPrice equals existing price", async () => {
    // No price change → no PriceHistory row, but the hppCalculationDetails
    // merge still happens because `retailMargin` may have changed.
    prismaMock.product.findFirst.mockResolvedValueOnce({
      id: "p1",
      name: "X",
      price: 12500,
      min_selling_price: 10000,
      hppCalculationDetails: {
        costs: [{ name: "a", amount: 100 }],
        safetyMargin: "5",
        retailMargin: 10,
      },
    
    } as any);

    prismaMock.product.update.mockResolvedValueOnce({
      id: "p1",
      name: "X",
      price: 12500,
      min_selling_price: 10000,
    
    } as any);

    const req = createRequest({ productId: "p1", customPrice: 12500 });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(prismaMock.product.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.priceHistory.create).not.toHaveBeenCalled();
  });
});
