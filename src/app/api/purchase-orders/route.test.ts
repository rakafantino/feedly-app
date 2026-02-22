/**
 * @jest-environment node
 */
import { GET, POST } from './route';
import { auth } from '@/lib/auth';
import { validateStoreAccess, hasPermission } from '@/lib/store-access';
import prisma from '@/lib/prisma';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

jest.mock('@/lib/store-access', () => ({
    validateStoreAccess: jest.fn(),
    hasPermission: jest.fn(),
}));

jest.mock('@/lib/prisma', () => {
    const mockPrisma = {
        purchaseOrder: {
            count: jest.fn(),
            findMany: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
        },
        purchaseOrderItem: {
            create: jest.fn(),
        },
        supplier: {
            findFirst: jest.fn(),
        },
        product: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
        },
        $transaction: jest.fn(),
    };

    mockPrisma.$transaction.mockImplementation((callback) => callback(mockPrisma));

    return {
        __esModule: true,
        default: mockPrisma,
    };
});

describe('Purchase Orders API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
        // Default mock for validateStoreAccess - allow access
        (validateStoreAccess as jest.Mock).mockResolvedValue({ valid: true, role: 'OWNER' });
        (hasPermission as jest.Mock).mockReturnValue(true);
    });

    describe('GET /api/purchase-orders', () => {
        it('should return 401 if unauthorized', async () => {
            (auth as jest.Mock).mockResolvedValue(null);
            const req = new NextRequest('http://localhost:3000/api/purchase-orders');
            const res = await GET(req);
            expect(res.status).toBe(401);
        });

        it('should return list of POs', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });
            (prismaMock.purchaseOrder.count).mockResolvedValue(1);

            const mockPOs = [{
                id: 'po-1',
                poNumber: 'PO-001',
                supplier: { name: 'Supplier', phone: '123' },
                items: [],
                createdAt: new Date(),
                status: 'pending'
            }];
            (prismaMock.purchaseOrder.findMany).mockResolvedValue(mockPOs);

            const req = new NextRequest('http://localhost:3000/api/purchase-orders');
            const res = await GET(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.purchaseOrders).toHaveLength(1);
            expect(data.pagination.total).toBe(1);
        });
    });

    describe('POST /api/purchase-orders', () => {
        it('should create valid PO', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });

            const poData = {
                supplierId: 'supp-1',
                items: [{ productId: 'prod-1', quantity: 10, price: 5000 }],
                notes: 'Test PO'
            };

            // Mock validations
            (prismaMock.supplier.findFirst).mockResolvedValue({ id: 'supp-1' });
            (prismaMock.product.findMany).mockResolvedValue([{ id: 'prod-1' }]);

            // Mock PO Number generation
            (prismaMock.purchaseOrder.findFirst).mockResolvedValue({ poNumber: 'PO-20230101-001' });

            (prismaMock.purchaseOrder.create).mockResolvedValue({ id: 'new-po', poNumber: 'PO-20230101-002' });

            const req = new NextRequest('http://localhost:3000/api/purchase-orders', {
                method: 'POST',
                body: JSON.stringify(poData)
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(201);
            expect(data.purchaseOrder.poNumber).toBe('PO-20230101-002');
            expect(prismaMock.purchaseOrder.create).toHaveBeenCalled();
            expect(prismaMock.purchaseOrderItem.create).toHaveBeenCalled();
        });

        it('should fail if supplier validation error', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });
            (prismaMock.supplier.findFirst).mockResolvedValue(null); // Supplier not found

            const poData = {
                supplierId: 'supp-invalid',
                items: [{ productId: 'prod-1', quantity: 10, price: 5000 }]
            };

            const req = new NextRequest('http://localhost:3000/api/purchase-orders', {
                method: 'POST',
                body: JSON.stringify(poData)
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toContain('Supplier tidak ditemukan');
        });
    });
});
