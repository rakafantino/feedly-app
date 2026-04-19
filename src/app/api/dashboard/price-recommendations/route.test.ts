/**
 * @jest-environment node
 */
import { GET } from './route';
import prisma from '@/lib/prisma';
import { NextRequest } from 'next/server';

// Mock api-middleware
jest.mock('@/lib/api-middleware', () => ({
    withAuth: (handler: any) => {
        return async (req: any, ...args: any[]) => {
            const session = { user: { id: 'user-1' } };
            const storeId = 'store-1';
            return handler(req, session, storeId, ...args);
        };
    }
}));

// Mock prisma
jest.mock('@/lib/prisma', () => ({
    __esModule: true,
    default: {
        product: {
            findMany: jest.fn(),
        },
    },
}));

describe('Dashboard Price Recommendations API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createRequest = () => {
        return new NextRequest('http://localhost:3000/api/dashboard/price-recommendations');
    };

    it('should return price recommendations based on default 10% margin', async () => {
        const mockProducts = [
            {
                id: 'prod-1',
                name: 'Product 1',
                price: 10000,
                min_selling_price: 10000,
                hppCalculationDetails: null,
                unit: 'pcs'
            }
        ];

        // Expected recommended price for prod-1: 
        // min_selling_price = 10000
        // margin = 10% -> 1000
        // recommended = 11000
        // since price 10000 < 11000, it should be recommended

        prismaMock.product.findMany.mockResolvedValue(mockProducts);

        const req = createRequest();
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.recommendations).toHaveLength(1);
        expect(data.recommendations[0]).toEqual({
            id: 'prod-1',
            name: 'Product 1',
            currentPrice: 10000,
            recommendedPrice: 11000,
            minSellingPrice: 10000,
            retailMargin: 10,
            unit: 'pcs'
        });
    });

    it('should return price recommendations based on explicit retail margin', async () => {
        const mockProducts = [
            {
                id: 'prod-2',
                name: 'Product 2',
                price: 11000,
                min_selling_price: 10000,
                hppCalculationDetails: { retailMargin: 20 },
                unit: 'pcs'
            }
        ];

        // Expected recommended price for prod-2: 
        // min_selling_price = 10000
        // margin = 20% -> 2000
        // recommended = 12000
        // since price 11000 < 12000, it should be recommended

        prismaMock.product.findMany.mockResolvedValue(mockProducts);

        const req = createRequest();
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.recommendations).toHaveLength(1);
        expect(data.recommendations[0]).toEqual({
            id: 'prod-2',
            name: 'Product 2',
            currentPrice: 11000,
            recommendedPrice: 12000,
            minSellingPrice: 10000,
            retailMargin: 20,
            unit: 'pcs'
        });
    });

    it('should not recommend if current price is higher or equal to recommended price', async () => {
        const mockProducts = [
            {
                id: 'prod-3',
                name: 'Product 3',
                price: 15000,
                min_selling_price: 10000,
                hppCalculationDetails: { retailMargin: 20 },
                unit: 'pcs'
            }
        ];

        // recommended = 12000. current = 15000 >= 12000 -> no recommendation

        prismaMock.product.findMany.mockResolvedValue(mockProducts);

        const req = createRequest();
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.recommendations).toHaveLength(0);
    });

    it('should skip products without min_selling_price', async () => {
        const mockProducts = [
            {
                id: 'prod-4',
                name: 'Product 4',
                price: 10000,
                min_selling_price: null,
                hppCalculationDetails: null,
                unit: 'pcs'
            }
        ];

        prismaMock.product.findMany.mockResolvedValue(mockProducts);

        const req = createRequest();
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.recommendations).toHaveLength(0);
    });

    it('should sort recommendations by largest price difference', async () => {
        const mockProducts = [
            {
                id: 'prod-5',
                name: 'Product 5',
                price: 10000,
                min_selling_price: 10000,
                hppCalculationDetails: { retailMargin: 10 }, // recommended = 11000. diff = 1000
                unit: 'pcs'
            },
            {
                id: 'prod-6',
                name: 'Product 6',
                price: 10000,
                min_selling_price: 15000,
                hppCalculationDetails: { retailMargin: 20 }, // recommended = 18000. diff = 8000
                unit: 'pcs'
            }
        ];

        prismaMock.product.findMany.mockResolvedValue(mockProducts);

        const req = createRequest();
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.recommendations).toHaveLength(2);
        // prod-6 has diff 8000, prod-5 has diff 1000
        expect(data.recommendations[0].id).toBe('prod-6');
        expect(data.recommendations[1].id).toBe('prod-5');
    });

    it('should properly round up to the nearest 1000', async () => {
        const mockProducts = [
            {
                id: 'prod-7',
                name: 'Product 7',
                price: 10000,
                min_selling_price: 10550, // 10% margin -> 11605
                hppCalculationDetails: { retailMargin: 10 },
                unit: 'pcs'
            }
        ];

        prismaMock.product.findMany.mockResolvedValue(mockProducts);

        const req = createRequest();
        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.recommendations).toHaveLength(1);
        expect(data.recommendations[0].recommendedPrice).toBe(12000); // 11605 rounded up to 12000
    });
});