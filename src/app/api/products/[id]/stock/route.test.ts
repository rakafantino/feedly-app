/**
 * @jest-environment node
 */
import { PUT } from './route';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { NotificationService } from '@/services/notification.service';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
    __esModule: true,
    default: {
        product: {
            findUnique: jest.fn(),
            update: jest.fn(),
        }
    },
}));

jest.mock('@/services/notification.service', () => ({
    NotificationService: {
        checkLowStockProducts: jest.fn(),
    }
}));

// Mock BatchService to avoid real excessive details
jest.mock('@/services/batch.service', () => ({
    BatchService: {
        addBatch: jest.fn(),
        deductStock: jest.fn(),
        addGenericBatch: jest.fn(),
    }
}));

describe('Product Stock Update API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createRequest = (id: string, body: any) => {
        return new NextRequest(`http://localhost:3000/api/products/${id}/stock`, {
            method: 'PUT',
            body: JSON.stringify(body),
        });
    };

    it('should return 401 if unauthorized', async () => {
        (auth as jest.Mock).mockResolvedValue(null);
        const req = createRequest('p1', { stock: 10 });
        const res = await PUT(req, { params: Promise.resolve({ id: 'p1' }) });
        expect(res.status).toBe(401);
    });

    it('should increment stock successfully', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });

        (prismaMock.product.findUnique).mockResolvedValue({
            id: 'p1',
            stock: 5,
            storeId: 'store-1'
        });
        
        // Batch service logic happens internally, we just test that NotificationService is called if it succeeds
        // Mock findUnique to return updated product after batch operations
        (prismaMock.product.findUnique)
            .mockResolvedValueOnce({ id: 'p1', stock: 5, storeId: 'store-1' }) // first call
            .mockResolvedValueOnce({ id: 'p1', stock: 15, storeId: 'store-1' }); // refetch

        const req = createRequest('p1', { stock: 10, operation: 'increment' });
        const res = await PUT(req, { params: Promise.resolve({ id: 'p1' }) });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.product.stock).toBe(15);
        expect(NotificationService.checkLowStockProducts).toHaveBeenCalled();
    });
});
