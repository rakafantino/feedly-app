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
        purchaseOrder: {
            findUnique: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
    },
}));

describe('Purchase Orders [ID] API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createRequest = (method: string, body?: any) => {
        const req = new NextRequest('http://localhost:3000/api/purchase-orders/po-1', {
            method,
            body: body ? JSON.stringify(body) : undefined,
        });
        Object.defineProperty(req, 'nextUrl', {
            value: { pathname: '/api/purchase-orders/po-1' }
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

        it('should return 404 if PO not found', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });
            (prismaMock.purchaseOrder.findUnique).mockResolvedValue(null);

            const req = createRequest('GET');
            const res = await GET(req);
            expect(res.status).toBe(404);
        });

        it('should return PO details', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });
            const mockPO = {
                id: 'po-1',
                poNumber: 'PO-001',
                supplier: { name: 'Sup', phone: '123' },
                items: [],
                createdAt: new Date(),
                status: 'pending'
            };
            (prismaMock.purchaseOrder.findUnique).mockResolvedValue(mockPO);

            const req = createRequest('GET');
            const res = await GET(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.purchaseOrder.id).toBe('po-1');
        });
    });

    describe('PUT', () => {
        it('should update PO status', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });
            const mockPO = { id: 'po-1' };
            (prismaMock.purchaseOrder.findUnique).mockResolvedValue(mockPO);

            const updatedPO = {
                ...mockPO,
                status: 'completed',
                supplier: {},
                items: [],
                createdAt: new Date()
            };
            (prismaMock.purchaseOrder.update).mockResolvedValue(updatedPO);

            const req = createRequest('PUT', { status: 'completed' });
            const res = await PUT(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.purchaseOrder.status).toBe('completed');
        });
    });

    describe('DELETE', () => {
        it('should delete PO', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });
            (prismaMock.purchaseOrder.findUnique).mockResolvedValue({ id: 'po-1' });
            (prismaMock.purchaseOrder.delete).mockResolvedValue({ id: 'po-1' });

            const req = createRequest('DELETE');
            const res = await DELETE(req);

            expect(res.status).toBe(200);
            expect(prismaMock.purchaseOrder.delete).toHaveBeenCalled();
        });
    });
});
