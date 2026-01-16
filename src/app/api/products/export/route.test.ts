/**
 * @jest-environment node
 */
import { GET } from './route';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
    __esModule: true,
    default: {
        product: {
            findMany: jest.fn(),
        }
    },
}));

describe('Product Export API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 401 if unauthorized', async () => {
        (auth as jest.Mock).mockResolvedValue(null);
        const res = await GET();
        expect(res.status).toBe(401);
    });

    it('should return csv file', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });

        const mockProducts = [
            {
                name: 'P1',
                description: 'Desc',
                category: 'Cat',
                price: 100,
                stock: 10,
                unit: 'pcs',
                barcode: '123'
            }
        ];
        (prismaMock.product.findMany).mockResolvedValue(mockProducts);

        const res = await GET();
        const blob = await res.blob();
        const text = await blob.text();

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe('text/csv');
        expect(text).toContain('name,description,category');
        expect(text).toContain('P1');
    });
});
