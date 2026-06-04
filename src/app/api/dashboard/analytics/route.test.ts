/**
 * @jest-environment node
 */
import { GET } from './route';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));
jest.mock('@/lib/prisma', () => {
    return {
        __esModule: true,
        default: {
            transaction: {
                findMany: jest.fn(),
                aggregate: jest.fn(),
            },
            expense: {
                aggregate: jest.fn(),
            },
            stockAdjustment: {
                aggregate: jest.fn(),
            },
            transactionItem: {
                aggregate: jest.fn(),
            },
            store: {
                findUnique: jest.fn(),
            },
            product: {
                findMany: jest.fn(),
                findFirst: jest.fn(),
            },
            productBatch: {
                findMany: jest.fn(),
                aggregate: jest.fn(),
            },
            $queryRaw: jest.fn().mockResolvedValue([]),
        },
    };
});
jest.mock('@/lib/dateUtils', () => ({
    calculateDateRange: jest.fn(() => ({
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-07')
    }))
}));

describe('Dashboard Analytics API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createRequest = () => {
        const req = new NextRequest('http://localhost:3000/api/dashboard/analytics?storeId=store-1');
        return req;
    };

    it('should return 401 if unauthorized', async () => {
        (auth as jest.Mock).mockResolvedValue(null);
        const req = createRequest();
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it('should return analytics data', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });

        const mockTransactions = [
            {
                createdAt: new Date('2023-01-02'), // Inside mocked range
                total: 10000,
                items: [{
                    quantity: 1,
                    price: 10000,
                    product: { category: 'A', name: 'P1', stock: 10 }
                }]
            }
        ];

        (prismaMock.transaction.findMany as jest.Mock).mockResolvedValue(mockTransactions);
        (prismaMock.transaction.aggregate as jest.Mock).mockResolvedValue({ _sum: { total: 10000, profit: 5000, writtenOffAmount: 0 }, _count: { _all: 2 } });
        (prismaMock.transactionItem.aggregate as jest.Mock).mockResolvedValue({ _sum: { quantity: 5 } });
        (prismaMock.expense.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: 1000 } });
        (prismaMock.stockAdjustment.aggregate as jest.Mock).mockResolvedValue({ _sum: { totalValue: 0 } });
        (prismaMock.store.findUnique as jest.Mock).mockResolvedValue({ dailyTarget: 100000 });
        (prismaMock.product.findMany as jest.Mock).mockResolvedValue([]); // For expiring / restock items
        (prismaMock.productBatch.findMany as jest.Mock).mockResolvedValue([]);

        const req = createRequest();
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.todayTotal).toBeDefined();
        expect(Array.isArray(data.salesData)).toBe(true);
        expect(data.categorySales).toHaveLength(1);
        expect(data.categorySales[0].name).toBe('A');
    });
});
