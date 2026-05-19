/**
 * @jest-environment node
 */
import fc from 'fast-check';
import { NextRequest } from 'next/server';

// Mock api-middleware to bypass auth and inject a fixed storeId
jest.mock('@/lib/api-middleware', () => ({
  withAuth: (handler: any) => {
    return async (req: any, ...args: any[]) => {
      const session = { user: { id: 'user-1', storeId: 'store-1' } };
      const storeId = 'store-1';
      return handler(req, session, storeId, ...args);
    };
  },
}));

// Mock prisma — only the slice this route touches
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    product: {
      findFirst: jest.fn(),
    },
    priceRecommendationDismissal: {
      upsert: jest.fn(),
    },
  },
}));

// IMPORTANT: import after mocks so the route picks up the mocked modules
import { POST } from '../dismiss/route';
import prisma from '@/lib/prisma';

const prismaMock = prisma as unknown as {
  product: { findFirst: jest.Mock };
  priceRecommendationDismissal: { upsert: jest.Mock };
};

const createRequest = (body: unknown) =>
  new NextRequest(
    'http://localhost:3000/api/dashboard/price-recommendations/dismiss',
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    },
  );

describe('POST /api/dashboard/price-recommendations/dismiss', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('standard cases', () => {
    it('200 happy path: snapshots current purchase_price into the dismissal', async () => {
      const dismissedAt = new Date('2025-01-15T10:30:00.000Z');
      prismaMock.product.findFirst.mockResolvedValue({ purchase_price: 5000 });
      prismaMock.priceRecommendationDismissal.upsert.mockResolvedValue({
        productId: 'p1',
        storeId: 'store-1',
        dismissedAtPurchasePrice: 5000,
        dismissedAt,
      });

      const req = createRequest({ productId: 'p1' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({
        productId: 'p1',
        dismissedAt: dismissedAt.toISOString(),
        dismissedAtPurchasePrice: 5000,
      });

      // product lookup is store-scoped
      expect(prismaMock.product.findFirst).toHaveBeenCalledWith({
        where: { id: 'p1', storeId: 'store-1', isDeleted: false },
        select: { purchase_price: true },
      });

      // upsert keyed on the unique (productId, dismissedAtPurchasePrice)
      expect(prismaMock.priceRecommendationDismissal.upsert).toHaveBeenCalledWith({
        where: {
          productId_dismissedAtPurchasePrice: {
            productId: 'p1',
            dismissedAtPurchasePrice: 5000,
          },
        },
        update: { dismissedAt: expect.any(Date) },
        create: {
          productId: 'p1',
          storeId: 'store-1',
          dismissedAtPurchasePrice: 5000,
          dismissedAt: expect.any(Date),
        },
      });
    });

    it('404 PRODUCT_NOT_FOUND when the product does not exist for this store', async () => {
      prismaMock.product.findFirst.mockResolvedValue(null);

      const req = createRequest({ productId: 'unknown' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.code).toBe('PRODUCT_NOT_FOUND');
      expect(prismaMock.priceRecommendationDismissal.upsert).not.toHaveBeenCalled();
    });

    it('200 with purchase_price=null stores the -1 sentinel in both where and create', async () => {
      const dismissedAt = new Date('2025-01-15T10:30:00.000Z');
      prismaMock.product.findFirst.mockResolvedValue({ purchase_price: null });
      prismaMock.priceRecommendationDismissal.upsert.mockResolvedValue({
        productId: 'p1',
        storeId: 'store-1',
        dismissedAtPurchasePrice: -1,
        dismissedAt,
      });

      const req = createRequest({ productId: 'p1' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.dismissedAtPurchasePrice).toBe(-1);

      const upsertArgs =
        prismaMock.priceRecommendationDismissal.upsert.mock.calls[0][0];
      expect(
        upsertArgs.where.productId_dismissedAtPurchasePrice
          .dismissedAtPurchasePrice,
      ).toBe(-1);
      expect(upsertArgs.create.dismissedAtPurchasePrice).toBe(-1);
    });

    it('400 INVALID_BODY when productId is missing', async () => {
      const req = createRequest({});
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.code).toBe('INVALID_BODY');
      expect(prismaMock.product.findFirst).not.toHaveBeenCalled();
      expect(
        prismaMock.priceRecommendationDismissal.upsert,
      ).not.toHaveBeenCalled();
    });

    it('500 INTERNAL when the upsert throws', async () => {
      prismaMock.product.findFirst.mockResolvedValue({ purchase_price: 5000 });
      prismaMock.priceRecommendationDismissal.upsert.mockRejectedValue(
        new Error('db is on fire'),
      );

      // Silence the route's console.error for this case
      const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const req = createRequest({ productId: 'p1' });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.code).toBe('INTERNAL');

      errSpy.mockRestore();
    });
  });

  // Feature: dynamic-price-recommendation, Property 6: Dismissal idempotence
  // Validates: Requirements 5.4
  //
  // Models the dismissal store as an in-memory Map keyed by
  // `(productId, dismissedAtPurchasePrice)` and replays the route's upsert
  // contract N times per iteration. Property holds iff the store ends up
  // with exactly one row whose `dismissedAt` equals the most recent
  // invocation's timestamp.
  describe('Property 6: Dismissal idempotence', () => {
    type Row = {
      productId: string;
      storeId: string;
      dismissedAtPurchasePrice: number;
      dismissedAt: Date;
    };

    type UpsertArgs = {
      where: {
        productId_dismissedAtPurchasePrice: {
          productId: string;
          dismissedAtPurchasePrice: number;
        };
      };
      update: { dismissedAt: Date };
      create: Row;
    };

    const makeUpsertStore = () => {
      const store = new Map<string, Row>();
      const upsert = (args: UpsertArgs): Row => {
        const { productId, dismissedAtPurchasePrice } =
          args.where.productId_dismissedAtPurchasePrice;
        const key = `${productId}|${dismissedAtPurchasePrice}`;
        const existing = store.get(key);
        if (existing) {
          const updated = { ...existing, ...args.update };
          store.set(key, updated);
          return updated;
        }
        const created = { ...args.create };
        store.set(key, created);
        return created;
      };
      return { store, upsert };
    };

    it('N successive calls leave exactly one row whose dismissedAt equals the most recent invocation', () => {
      fc.assert(
        fc.property(
          fc.record({
            productId: fc.string({ minLength: 1, maxLength: 8 }),
            // include the -1 sentinel for null purchase_price alongside real prices
            purchasePrice: fc.oneof(
              fc.integer({ min: 0, max: 1_000_000 }),
              fc.constant(-1),
            ),
            n: fc.integer({ min: 1, max: 20 }),
          }),
          ({ productId, purchasePrice, n }) => {
            const { store, upsert } = makeUpsertStore();

            // simulate N successive dismiss handler invocations with
            // strictly monotonically increasing timestamps
            const baseMs = Date.now();
            let lastDismissedAt: Date | null = null;
            for (let i = 0; i < n; i++) {
              const now = new Date(baseMs + i);
              upsert({
                where: {
                  productId_dismissedAtPurchasePrice: {
                    productId,
                    dismissedAtPurchasePrice: purchasePrice,
                  },
                },
                update: { dismissedAt: now },
                create: {
                  productId,
                  storeId: 'store-1',
                  dismissedAtPurchasePrice: purchasePrice,
                  dismissedAt: now,
                },
              });
              lastDismissedAt = now;
            }

            // exactly one row for the (productId, purchasePrice) key
            expect(store.size).toBe(1);
            const [onlyRow] = Array.from(store.values());
            expect(onlyRow.productId).toBe(productId);
            expect(onlyRow.dismissedAtPurchasePrice).toBe(purchasePrice);
            expect(onlyRow.storeId).toBe('store-1');

            // dismissedAt equals the timestamp of the most recent invocation
            expect(onlyRow.dismissedAt).toEqual(lastDismissedAt);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
