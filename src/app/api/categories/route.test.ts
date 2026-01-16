/**
 * @jest-environment node
 */
import { GET } from './route';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';
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
        },
    },
}));

describe('Categories API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 401 if user is not authenticated', async () => {
        (auth as jest.Mock).mockResolvedValue(null);
        const req = new NextRequest('http://localhost:3000/api/categories');
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it('should return categories for store from session', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });

        const mockCategories = [{ category: 'Electronics' }, { category: 'Food' }];
        (prismaMock.product.findMany as jest.Mock).mockResolvedValue(mockCategories);

        const req = new NextRequest('http://localhost:3000/api/categories');
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.categories).toEqual(['Electronics', 'Food']);
        expect(data.storeId).toBe('store-1');
        expect(prismaMock.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ storeId: 'store-1' }),
            distinct: ['category']
        }));
    });

    it('should fallback to query param storeId', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { storeId: null } }); // Session has no store

        const mockCategories = [{ category: 'Books' }];
        (prismaMock.product.findMany as jest.Mock).mockResolvedValue(mockCategories);

        const req = new NextRequest('http://localhost:3000/api/categories?storeId=store-param');
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.categories).toEqual(['Books']);
        expect(data.storeId).toBe('store-param');
        expect(prismaMock.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ storeId: 'store-param' })
        }));
    });
});
