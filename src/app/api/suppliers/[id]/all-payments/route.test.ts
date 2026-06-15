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

// We must mock the prisma from @/lib/prisma to prevent it from calling real DB methods
// that are not part of the enhanced mock, or to specifically control them.
jest.mock('@/lib/prisma', () => ({
    __esModule: true,
    default: {
        batchPaymentSession: {
            findMany: jest.fn(),
        },
        purchaseOrderPayment: {
            findMany: jest.fn(),
        },
    },
}));

// Mock @/lib/db because api-middleware uses it for RLS context
jest.mock('@/lib/db', () => ({
    __esModule: true,
    default: {
        $executeRaw: jest.fn().mockResolvedValue(true),
    },
}));

describe('Suppliers [ID] All Payments API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createRequest = () => {
        return new NextRequest('http://localhost:3000/api/suppliers/sup-1/all-payments');
    };

    it('should return 401 if unauthorized', async () => {
        (auth as jest.Mock).mockResolvedValue(null);
        
        const req = createRequest();
        const res = await GET(req, { params: Promise.resolve({ id: 'sup-1' }) } as any);
        
        expect(res.status).toBe(401);
    });

    it('should return 400 if storeId is missing', async () => {
        // user without storeId
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
        
        const req = createRequest();
        const res = await GET(req, { params: Promise.resolve({ id: 'sup-1' }) } as any);
        
        expect(res.status).toBe(400);
        const data = await res.json();
        // Since withAuth has requireStore: true, it will actually return 400 early
        expect(data.error).toBe('Store selection required');
    });

    it('should return 400 if supplierId is not valid', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1', storeId: 'store-1' } });
        
        const req = createRequest();
        // Sending undefined id
        const res = await GET(req, { params: Promise.resolve({ id: '' }) } as any);
        
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe('ID supplier tidak valid');
    });

    it('should fetch all payments successfully and sort them', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1', storeId: 'store-1' } });
        
        const mockBatchPayments = [
            {
                id: 'bp-1',
                totalAmount: 1000,
                paymentMethod: 'TRANSFER',
                notes: 'Batch payment 1',
                createdAt: new Date('2023-01-01T10:00:00Z'),
                payments: [
                    {
                        id: 'p-1',
                        amount: 1000,
                        paidAt: new Date('2023-01-01T10:00:00Z'),
                        purchaseOrder: { id: 'po-1', poNumber: 'PO-001' }
                    }
                ]
            }
        ];

        const mockStandalonePayments = [
            {
                id: 'p-2',
                amount: 500,
                paymentMethod: 'CASH',
                notes: 'Standalone payment',
                paidAt: new Date('2023-01-02T10:00:00Z'),
                purchaseOrder: { id: 'po-2', poNumber: 'PO-002' }
            }
        ];

        prismaMock.batchPaymentSession.findMany.mockResolvedValue(mockBatchPayments);
        prismaMock.purchaseOrderPayment.findMany.mockResolvedValue(mockStandalonePayments);

        const req = createRequest();
        const res = await GET(req, { params: Promise.resolve({ id: 'sup-1' }) } as any);
        
        expect(res.status).toBe(200);
        
        const data = await res.json();
        
        // Output should be merged array length 2
        expect(data.length).toBe(2);
        
        // Sorted by descending date (standalone is newer: 2023-01-02 vs bp: 2023-01-01)
        expect(data[0].id).toBe('p-2');
        expect(data[0].isBatch).toBe(false);
        expect(data[0].paymentCount).toBe(1);
        
        expect(data[1].id).toBe('bp-1');
        expect(data[1].isBatch).toBe(true);
        expect(data[1].paymentCount).toBe(1);
    });

    it('should return 500 if database query fails', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1', storeId: 'store-1' } });
        
        prismaMock.batchPaymentSession.findMany.mockRejectedValue(new Error('DB Error'));

        // Mock console.error to avoid test output noise
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const req = createRequest();
        const res = await GET(req, { params: Promise.resolve({ id: 'sup-1' }) } as any);
        
        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.error).toBe('Terjadi kesalahan saat mengambil seluruh riwayat pembayaran');
        
        consoleSpy.mockRestore();
    });
});
