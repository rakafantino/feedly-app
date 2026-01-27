import { PUT } from './route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma'; // This imports the mocked version

// Define mock structure first
const mockPrismaClient = {
    purchaseOrder: {
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    product: {
        update: jest.fn(),
    },
    purchaseOrderItem: {
        update: jest.fn(),
    },
    $transaction: jest.fn(),
};

// Implement transaction to call callback with self
(mockPrismaClient.$transaction as jest.Mock).mockImplementation((callback: any) => callback(mockPrismaClient));

// Mock module using the defined object
// Note: In Jest, we often need to be careful with hoisting. 
// But assigning implementation outside factory relies on import.
// Safer way for strictly hoisted jest.mock:
jest.mock('@/lib/prisma', () => {

    // Proper way to circular ref in factory:
    const client: any = {
        purchaseOrder: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
        product: { update: jest.fn() },
        purchaseOrderItem: { update: jest.fn() },
        productBatch: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    };
    client.$transaction = jest.fn((cb: any) => cb(client));

    return {
        __esModule: true,
        default: client,
    };
});

jest.mock('@/lib/api-middleware', () => ({
    withAuth: (handler: any) => handler,
}));

describe('PUT /api/purchase-orders/[id]', () => {
    const storeId = 'store-123';
    const poId = 'po-123';
    const productId = 'prod-123';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should increment stock when status changes to received (Legacy/Full)', async () => {
        const existingPO = {
            id: poId,
            status: 'ordered',
            storeId: storeId,
            items: [
                { id: 'item-1', productId: productId, quantity: 10, receivedQuantity: 0, price: 1000 }
            ]
        };

        const updatedPO = {
            ...existingPO,
            status: 'received',
            items: [
                {
                    ...existingPO.items[0],
                    product: { name: 'Test Product' }
                }
            ],
            supplier: { id: 'sup-1', name: 'Supplier 1' },
            createdAt: new Date(),
            estimatedDelivery: null
        };

        (prisma.purchaseOrder.findUnique as jest.Mock)
            .mockResolvedValueOnce(existingPO)
            .mockResolvedValueOnce(updatedPO);

        (prisma.purchaseOrder.update as jest.Mock).mockResolvedValue(updatedPO);

        const req = new NextRequest(`http://localhost:3000/api/purchase-orders/${poId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'received' })
        });

        const response = await PUT(req, {}, storeId);
        const data = await response.json();

        expect(prisma.$transaction).toHaveBeenCalled();
        expect(prisma.product.update).toHaveBeenCalledWith({
            where: { id: productId },
            data: { stock: { increment: 10 } }
        });
        expect(data.purchaseOrder.status).toBe('received');
    });

    it('should handle partial receipt correctly', async () => {
        const existingPO = {
            id: poId,
            status: 'ordered',
            storeId: storeId,
            items: [
                { id: 'item-1', productId: productId, quantity: 10, receivedQuantity: 0, price: 1000 }
            ]
        };

        const updatedPO = {
            ...existingPO,
            status: 'partially_received',
            items: [
                { ...existingPO.items[0], receivedQuantity: 5, product: { name: 'Test Product' } }
            ],
            supplier: { id: 'sup-1', name: 'Supplier 1' },
            createdAt: new Date(),
            estimatedDelivery: null
        };

        (prisma.purchaseOrder.findUnique as jest.Mock)
            .mockResolvedValueOnce(existingPO)
            .mockResolvedValueOnce(updatedPO);

        const req = new NextRequest(`http://localhost:3000/api/purchase-orders/${poId}`, {
            method: 'PUT',
            body: JSON.stringify({
                items: [{ id: 'item-1', receivedQuantity: 5 }],
                closePo: false
            })
        });

        const response = await PUT(req, {}, storeId);
        await response.json();

        expect(prisma.product.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: productId },
            data: { stock: { increment: 5 } }
        }));

        expect(prisma.purchaseOrderItem.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 'item-1' },
            data: { receivedQuantity: { increment: 5 } }
        }));

        expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ status: 'partially_received' })
        }));
    });

    it('should close PO if closePo is true even if partial', async () => {
        const existingPO = {
            id: poId,
            status: 'ordered',
            storeId: storeId,
            items: [
                { id: 'item-1', productId: productId, quantity: 10, receivedQuantity: 0, price: 1000 }
            ]
        };

        const updatedPO = {
            ...existingPO,
            status: 'received',
            items: [{ ...existingPO.items[0], product: { name: 'Test' } }]
            // Note: Updated PO mock should have supplier for response formatting
            , supplier: { id: 'sup-1', name: 'Supplier 1' },
            createdAt: new Date(),
            estimatedDelivery: null
        };

        (prisma.purchaseOrder.findUnique as jest.Mock)
            .mockResolvedValueOnce(existingPO)
            .mockResolvedValueOnce(updatedPO);

        const req = new NextRequest(`http://localhost:3000/api/purchase-orders/${poId}`, {
            method: 'PUT',
            body: JSON.stringify({
                items: [{ id: 'item-1', receivedQuantity: 5 }],
                closePo: true
            })
        });

        await PUT(req, {}, storeId);

        expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ status: 'received' })
        }));
    });

    it('should NOT increment stock for normal updates', async () => {
        const existingPO = {
            id: poId,
            status: 'draft',
            storeId: storeId,
            items: [],
            supplier: { id: 'sup-1', name: 'Supplier 1' },
            createdAt: new Date()
        };

        const updatedPO = {
            ...existingPO,
            status: 'ordered',
            supplier: { id: 'sup-1', name: 'Supplier 1' },
            createdAt: new Date(),
            estimatedDelivery: null
        };

        (prisma.purchaseOrder.findUnique as jest.Mock).mockResolvedValue(existingPO);
        (prisma.purchaseOrder.update as jest.Mock).mockResolvedValue(updatedPO);

        const req = new NextRequest(`http://localhost:3000/api/purchase-orders/${poId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'ordered' })
        });

        await PUT(req, {}, storeId);

        expect(prisma.$transaction).not.toHaveBeenCalled();
        expect(prisma.product.update).not.toHaveBeenCalled();
    });
});
