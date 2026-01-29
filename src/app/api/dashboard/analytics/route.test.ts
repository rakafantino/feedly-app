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

jest.mock('@/lib/prisma', () => ({
    __esModule: true,
    default: {
        transaction: {
            findMany: jest.fn(),
        },
        store: {
            findUnique: jest.fn(),
        },
        product: {
            findMany: jest.fn(),
        },
        productBatch: {
            findMany: jest.fn().mockResolvedValue([]),
        },
        $queryRaw: jest.fn().mockResolvedValue([]),
    },
}));

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

        (prismaMock.transaction.findMany).mockResolvedValue(mockTransactions);
        (prismaMock.store.findUnique).mockResolvedValue({ dailyTarget: 100000 });
        (prismaMock.product.findMany).mockResolvedValue([]); // For inventory calc

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
