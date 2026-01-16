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
            fields: { threshold: 'threshold' }
        }
    },
}));

describe('Low Stock API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 401 if unauthorized', async () => {
        (auth as jest.Mock).mockResolvedValue(null);
        const res = await GET();
        expect(res.status).toBe(401);
    });

    it('should return low stock products', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });

        const mockProducts = [{ id: 'p1', name: 'Low Stock Item' }];
        (prismaMock.product.findMany).mockResolvedValue(mockProducts);

        const res = await GET();
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.products).toHaveLength(1);
        expect(data.count).toBe(1);
    });
});
