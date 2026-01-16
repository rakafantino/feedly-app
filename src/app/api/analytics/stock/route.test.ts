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
        product: {
            findMany: jest.fn(),
            fields: { threshold: 'threshold' }
        },
        transaction: {
            findMany: jest.fn(),
        }
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

    it('should return stock analytics', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });

        const mockProducts = [
            { name: 'P1', stock: 5, price: 1000, category: 'Food' }
        ];
        // First findMany is lowStockProducts, Second is allProducts
        (prismaMock.product.findMany)
            .mockResolvedValueOnce([]) // low stock
            .mockResolvedValueOnce(mockProducts); // all

        (prismaMock.transaction.findMany).mockResolvedValue([]);

        const req = createRequest();
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.categoryStats).toHaveLength(1);
        expect(data.categoryStats[0].name).toBe('Food');
        expect(data.lowStockCount).toBe(0);
    });
});
