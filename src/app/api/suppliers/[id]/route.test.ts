/**
 * @jest-environment node
 */
import { GET, PUT, DELETE } from './route';
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
        supplier: {
            findFirst: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        product: {
            count: jest.fn(),
        },
        purchaseOrder: {
            findMany: jest.fn(),
        }
    },
}));

describe('Suppliers [ID] API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createRequest = (method: string, body?: any) => {
        const req = new NextRequest('http://localhost:3000/api/suppliers/sup-1', {
            method,
            body: body ? JSON.stringify(body) : undefined,
        });
        // Mock nextUrl property which is used in the route
        Object.defineProperty(req, 'nextUrl', {
            value: { pathname: '/api/suppliers/sup-1' }
        });
        return req;
    };

    describe('GET', () => {
        it('should return 401 if unauthorized', async () => {
            (auth as jest.Mock).mockResolvedValue(null);
            const req = createRequest('GET');
            const res = await GET(req);
            expect(res.status).toBe(401);
        });

        it('should return 404 if supplier not found', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });
            (prismaMock.supplier.findFirst).mockResolvedValue(null);

            const req = createRequest('GET');
            const res = await GET(req);
            expect(res.status).toBe(404);
        });

        it('should return supplier details with POs', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });
            const mockSupplier = { id: 'sup-1', name: 'Supplier A' };
            (prismaMock.supplier.findFirst).mockResolvedValue(mockSupplier);
            (prismaMock.purchaseOrder.findMany).mockResolvedValue([]);

            const req = createRequest('GET');
            const res = await GET(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.supplier.id).toBe('sup-1');
            expect(data.supplier.purchaseOrders).toEqual([]);
        });
    });

    describe('PUT', () => {
        it('should update supplier successfully', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });
            (prismaMock.supplier.findFirst).mockResolvedValue({ id: 'sup-1' });
            (prismaMock.supplier.update).mockResolvedValue({ id: 'sup-1', name: 'Updated Name' });

            const req = createRequest('PUT', { name: 'Updated Name', email: 'new@example.com' });
            const res = await PUT(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.supplier.name).toBe('Updated Name');
        });

        it('should return 400 for validation error', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });
            const req = createRequest('PUT', { name: '' }); // Empty name should fail min(1)
            const res = await PUT(req);
            expect(res.status).toBe(400);
        });
    });

    describe('DELETE', () => {
        it('should prevent delete if products exist', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });
            (prismaMock.product.count).mockResolvedValue(5); // 5 products linked

            const req = createRequest('DELETE');
            const res = await DELETE(req);
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toContain('digunakan oleh beberapa produk');
        });

        it('should delete supplier if no dependencies', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });
            (prismaMock.product.count).mockResolvedValue(0);
            (prismaMock.supplier.findFirst).mockResolvedValue({ id: 'sup-1' });
            (prismaMock.supplier.delete).mockResolvedValue({ id: 'sup-1' });

            const req = createRequest('DELETE');
            const res = await DELETE(req);

            expect(res.status).toBe(200);
            expect(prismaMock.supplier.delete).toHaveBeenCalledWith({ where: { id: 'sup-1' } });
        });
    });
});
