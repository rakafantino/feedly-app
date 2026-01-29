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
        store: { findUnique: jest.fn() },
        purchaseOrder: { count: jest.fn() },
        product: {
            count: jest.fn(),
            fields: { threshold: 'threshold' }
        },
        transaction: {
            findMany: jest.fn(),
        },
        $queryRaw: jest.fn()
    },
}));

jest.mock('@/lib/dateUtils', () => ({
    calculateDateRange: jest.fn(() => ({
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-07')
    }))
}));

describe('Analytics Stock API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createRequest = () => {
        const req = new NextRequest('http://localhost:3000/api/analytics/stock?storeId=store-1');
        return req;
    };

    it('should return 401 if unauthorized', async () => {
        (auth as jest.Mock).mockResolvedValue(null);
        const req = createRequest();
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it('should return stock analytics with optimized queries', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });

        // Mock parallel queries
        (prismaMock.store.findUnique).mockResolvedValue({ expiryNotificationDays: 30 });
        (prismaMock.purchaseOrder.count).mockResolvedValue(5); // Pending POs
        
        // Count calls: 1. Low Stock, 2. Expiring
        (prismaMock.product.count)
            .mockResolvedValueOnce(2) // Low stock count
            .mockResolvedValueOnce(3); // Expiring count

        (prismaMock.$queryRaw).mockResolvedValue([
            { category: 'Food', count: BigInt(10), value: 50000 }
        ]);

        (prismaMock.transaction.findMany).mockResolvedValue([]);

        const req = createRequest();
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        
        // Verify Stats
        expect(data.categoryStats).toHaveLength(1);
        expect(data.categoryStats[0].name).toBe('Food');
        expect(data.categoryStats[0].count).toBe(10); // Converted from BigInt
        expect(data.categoryStats[0].value).toBe(50000);
        
        expect(data.lowStockCount).toBe(2);
        expect(data.expiringCount).toBe(3);
        expect(data.pendingOrdersCount).toBe(5);
        
        // Verify correct prisma calls
        expect(prismaMock.product.count).toHaveBeenCalledTimes(2);
        expect(prismaMock.$queryRaw).toHaveBeenCalled();
    });
});


