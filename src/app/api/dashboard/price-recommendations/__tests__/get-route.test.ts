/**
 * @jest-environment node
 *
 * Integration tests for `GET /api/dashboard/price-recommendations`.
 *
 * Production-database safety:
 *   - All Prisma calls are mocked via `jest-mock-extended`.
 *   - No real database connection is opened by these tests.
 */

// 1. Mock Prisma with a deep proxy so any nested model/method is auto-stubbed.
jest.mock('@/lib/prisma', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockDeep } = require('jest-mock-extended');
  return {
    __esModule: true,
    default: mockDeep(),
  };
});

// 2. Bypass authentication / store-scope plumbing — this suite is focused on
//    the recommendation logic and the dismissal filtering integration. The
//    `withAuth` wrapper is exercised in its own dedicated tests.
jest.mock('@/lib/api-middleware', () => ({
  withAuth: (handler: any) => {
    return async (req: any, ...args: any[]) => {
      const session = { user: { id: 'user-1', storeId: 'store-1' } };
      const storeId = 'store-1';
      return handler(req, session, storeId, ...args);
    };
  },
}));

import { GET } from '../route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

const createRequest = () =>
  new NextRequest('http://localhost:3000/api/dashboard/price-recommendations');

/**
 * Default to "no dismissals" so existing behavior tests don't have to be
 * dismissal-aware. Individual tests override this when needed.
 */
function mockNoDismissals() {
  prismaMock.priceRecommendationDismissal.findMany.mockResolvedValue([] as any);
}

describe('GET /api/dashboard/price-recommendations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNoDismissals();
  });

  // ---------------------------------------------------------------------------
  // Pre-existing GET behavior (margin calculation, sorting, rounding)
  // ---------------------------------------------------------------------------
  describe('recommendation calculation', () => {
    it('returns recommendations using a default 10% margin when retailMargin is missing', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          name: 'Product 1',
          price: 10000,
          purchase_price: 8000,
          min_selling_price: 10000,
          hppCalculationDetails: null,
          unit: 'pcs',
        },
      ] as any);

      const res = await GET(createRequest());
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.recommendations).toHaveLength(1);
      expect(data.recommendations[0]).toEqual({
        id: 'prod-1',
        name: 'Product 1',
        currentPrice: 10000,
        rawRecommendedPrice: 11000,
        recommendedPriceUp: 11000,
        recommendedPriceDown: 11000,
        minSellingPrice: 10000,
        retailMargin: 10,
        unit: 'pcs',
      });
    });

    it('uses an explicit retailMargin from hppCalculationDetails', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-2',
          name: 'Product 2',
          price: 11000,
          purchase_price: 9000,
          min_selling_price: 10000,
          hppCalculationDetails: { retailMargin: 20 },
          unit: 'pcs',
        },
      ] as any);

      const res = await GET(createRequest());
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.recommendations).toHaveLength(1);
      expect(data.recommendations[0].retailMargin).toBe(20);
      expect(data.recommendations[0].recommendedPriceUp).toBe(12000);
    });

    it('omits products whose current price is at or above the recommended price', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-3',
          name: 'Product 3',
          price: 15000,
          purchase_price: 9000,
          min_selling_price: 10000,
          hppCalculationDetails: { retailMargin: 20 },
          unit: 'pcs',
        },
      ] as any);

      const res = await GET(createRequest());
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.recommendations).toHaveLength(0);
    });

    it('skips products with a null min_selling_price', async () => {
      // The route already filters `min_selling_price: { not: null }` at the
      // Prisma layer; this test asserts the in-process guard is also in place
      // by feeding through a product that slips past the where clause.
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-4',
          name: 'Product 4',
          price: 10000,
          purchase_price: 5000,
          min_selling_price: null,
          hppCalculationDetails: null,
          unit: 'pcs',
        },
      ] as any);

      const res = await GET(createRequest());
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.recommendations).toHaveLength(0);
    });

    it('rounds the raw recommended price up and down to the nearest 1000', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'prod-7',
          name: 'Product 7',
          price: 10000,
          purchase_price: 8000,
          min_selling_price: 10550, // 10% margin -> 11605
          hppCalculationDetails: { retailMargin: 10 },
          unit: 'pcs',
        },
      ] as any);

      const res = await GET(createRequest());
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.recommendations).toHaveLength(1);
      expect(data.recommendations[0].rawRecommendedPrice).toBe(11605);
      expect(data.recommendations[0].recommendedPriceUp).toBe(12000);
      expect(data.recommendations[0].recommendedPriceDown).toBe(11000);
    });
  });

  // ---------------------------------------------------------------------------
  // Task 7.2: Dismissal-aware filtering & ordering
  // ---------------------------------------------------------------------------
  describe('dismissal filtering (Requirements 1.3, 1.4, 5.6, 5.7)', () => {
    // (a) Excludes a product whose latest dismissal price equals current price.
    it('excludes a product whose latest dismissal purchase price matches the current purchase_price', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Pakan Ayam',
          price: 6000,
          purchase_price: 5000,
          min_selling_price: 7000, // gap exists -> would be recommended without dismissal
          hppCalculationDetails: { retailMargin: 10 },
          unit: 'kg',
        },
      ] as any);
      prismaMock.priceRecommendationDismissal.findMany.mockResolvedValue([
        {
          productId: 'p1',
          dismissedAtPurchasePrice: 5000,
        },
      ] as any);

      const res = await GET(createRequest());
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.recommendations).toEqual([]);
      // Sanity-check that the route did query the dismissals table for this store.
      expect(prismaMock.priceRecommendationDismissal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { storeId: 'store-1' },
          orderBy: { dismissedAt: 'desc' },
        }),
      );
    });

    // (b) Includes a product whose purchase price has changed since dismissal.
    it('includes a product whose purchase_price has changed since the last dismissal', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'p2',
          name: 'Beras 5kg',
          price: 65000,
          purchase_price: 6000, // current
          min_selling_price: 70000,
          hppCalculationDetails: { retailMargin: 10 },
          unit: 'kg',
        },
      ] as any);
      prismaMock.priceRecommendationDismissal.findMany.mockResolvedValue([
        {
          productId: 'p2',
          dismissedAtPurchasePrice: 5000, // historical, no longer matches current
        },
      ] as any);

      const res = await GET(createRequest());
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.recommendations).toHaveLength(1);
      expect(data.recommendations[0].id).toBe('p2');
    });

    // (c) null purchase_price ↔ -1 sentinel match excludes the product.
    it('treats a null purchase_price as the -1 sentinel and excludes when the dismissal stored -1', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'p3',
          name: 'Produk Tanpa HPP',
          price: 8000,
          purchase_price: null,
          min_selling_price: 10000,
          hppCalculationDetails: { retailMargin: 10 },
          unit: 'pcs',
        },
      ] as any);
      prismaMock.priceRecommendationDismissal.findMany.mockResolvedValue([
        {
          productId: 'p3',
          dismissedAtPurchasePrice: -1, // sentinel for null purchase_price
        },
      ] as any);

      const res = await GET(createRequest());
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.recommendations).toEqual([]);
    });

    // (d) Preserves recommended ordering by largest price gap with mixed
    //     dismissed / non-dismissed products.
    it('preserves recommended ordering by largest price gap after dismissal filtering', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        // Smallest gap (1000)
        {
          id: 'p-small',
          name: 'Small Gap',
          price: 10000,
          purchase_price: 7000,
          min_selling_price: 10000,
          hppCalculationDetails: { retailMargin: 10 }, // -> 11000, gap 1000
          unit: 'pcs',
        },
        // Largest gap (8000) but DISMISSED at the current purchase price
        {
          id: 'p-dismissed',
          name: 'Dismissed Big Gap',
          price: 10000,
          purchase_price: 12000,
          min_selling_price: 15000,
          hppCalculationDetails: { retailMargin: 20 }, // -> 18000, gap 8000
          unit: 'pcs',
        },
        // Medium gap (4000)
        {
          id: 'p-medium',
          name: 'Medium Gap',
          price: 10000,
          purchase_price: 9000,
          min_selling_price: 12000,
          hppCalculationDetails: { retailMargin: 15 }, // -> 13800 -> ceil 14000, gap 4000
          unit: 'pcs',
        },
      ] as any);
      prismaMock.priceRecommendationDismissal.findMany.mockResolvedValue([
        {
          productId: 'p-dismissed',
          dismissedAtPurchasePrice: 12000,
        },
      ] as any);

      const res = await GET(createRequest());
      const data = await res.json();

      expect(res.status).toBe(200);
      // Dismissed product is filtered out; remaining two are sorted by gap desc.
      expect(data.recommendations.map((r: any) => r.id)).toEqual([
        'p-medium',
        'p-small',
      ]);
    });

    // (e) Bonus: when multiple dismissals exist for the same product, only the
    //     most recent one (first row when ordered by dismissedAt desc) is used.
    it('uses only the most recent dismissal when a product has multiple historical dismissals', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'p-multi',
          name: 'Multi-dismissed',
          price: 10000,
          purchase_price: 5000, // current matches latest dismissal -> exclude
          min_selling_price: 12000,
          hppCalculationDetails: { retailMargin: 10 },
          unit: 'pcs',
        },
      ] as any);
      // Mock returns rows ordered by `dismissedAt desc` — the FIRST row is the
      // most recent.
      prismaMock.priceRecommendationDismissal.findMany.mockResolvedValue([
        { productId: 'p-multi', dismissedAtPurchasePrice: 5000 }, // latest, matches current
        { productId: 'p-multi', dismissedAtPurchasePrice: 4000 }, // older, would NOT match
        { productId: 'p-multi', dismissedAtPurchasePrice: 3000 }, // even older
      ] as any);

      const res = await GET(createRequest());
      const data = await res.json();

      expect(res.status).toBe(200);
      // Latest dismissal (5000) matches current purchase_price (5000) -> excluded.
      expect(data.recommendations).toEqual([]);
    });

    it('keeps a product when only an older (non-latest) dismissal would match the current purchase_price', async () => {
      prismaMock.product.findMany.mockResolvedValue([
        {
          id: 'p-stale',
          name: 'Stale-dismiss-only',
          price: 10000,
          purchase_price: 4000, // matches an OLDER dismissal but not the latest
          min_selling_price: 12000,
          hppCalculationDetails: { retailMargin: 10 },
          unit: 'pcs',
        },
      ] as any);
      // Latest dismissal stored 5000 (does NOT match current 4000); the row at
      // 4000 is older and must be ignored by the route's "keep most recent"
      // reduction.
      prismaMock.priceRecommendationDismissal.findMany.mockResolvedValue([
        { productId: 'p-stale', dismissedAtPurchasePrice: 5000 },
        { productId: 'p-stale', dismissedAtPurchasePrice: 4000 },
      ] as any);

      const res = await GET(createRequest());
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.recommendations).toHaveLength(1);
      expect(data.recommendations[0].id).toBe('p-stale');
    });
  });
});
