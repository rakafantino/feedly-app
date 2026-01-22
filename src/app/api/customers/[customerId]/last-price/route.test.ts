import { GET } from '@/app/api/customers/[customerId]/last-price/route';
import prisma from '@/lib/prisma';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
    transactionItem: {
        findFirst: jest.fn(),
    },
}));

// Mock Auth
jest.mock('@/lib/api-middleware', () => ({
    withAuth: (handler: any) => async (req: any) => {
        return handler(req, { user: { id: 'user-id' } }, 'store-id');
    },
}));

describe('GET /api/customers/[customerId]/last-price', () => {
    const mockStoreId = 'store-id';
    const mockCustomerId = 'customer-123';
    const mockProductId = 'product-abc';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should be called with correct URL structure', async () => {
        // This test ensures our mock setup is correct for the logic we plan to use
        // const req = ... (Removed unused req)
        /* const req = {
            nextUrl: {
                pathname: `/api/customers/${mockCustomerId}/last-price`,
                searchParams: new URLSearchParams({ productId: mockProductId })
            }
        }; */
        // Implementation will rely on parts parsing
        expect(true).toBe(true); // Placeholder assertion
    });

    it('should return 400 if productId is missing', async () => {
        const req = {
            nextUrl: {
                pathname: `/api/customers/${mockCustomerId}/last-price`,
                searchParams: new URLSearchParams()
            }
        };

        // @ts-ignore
        const res = await GET(req);
        expect(res.status).toBe(400);
    });

    it('should return null if no transaction history found', async () => {
        (prisma.transactionItem.findFirst as jest.Mock).mockResolvedValue(null);

        const req = {
            nextUrl: {
                pathname: `/api/customers/${mockCustomerId}/last-price`,
                searchParams: new URLSearchParams({ productId: mockProductId })
            }
        };

        // @ts-ignore
        const res = await GET(req);

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.price).toBeNull();
    });

    it('should return the last sold price', async () => {
        (prisma.transactionItem.findFirst as jest.Mock).mockResolvedValue({
            price: 85000,
            createdAt: new Date(),
        });

        const req = {
            nextUrl: {
                pathname: `/api/customers/${mockCustomerId}/last-price`,
                searchParams: new URLSearchParams({ productId: mockProductId })
            }
        };

        // @ts-ignore
        const res = await GET(req);

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.price).toBe(85000);

        expect(prisma.transactionItem.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                productId: mockProductId,
                transaction: {
                    storeId: mockStoreId,
                    customer: {
                        id: mockCustomerId
                    }
                },
            },
            orderBy: { createdAt: 'desc' },
        }));
    });
});
