/**
 * @jest-environment node
 */
import { GET, POST } from './route';
import prisma from '@/lib/prisma';
import { BatchService } from '@/services/batch.service';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/prisma', () => {
    const mockPrisma = {
        transaction: {
            findMany: jest.fn(),
            create: jest.fn(),
            count: jest.fn(),
            findFirst: jest.fn(),
        },
        transactionItem: {
            create: jest.fn(),
        },
        product: {
            findFirst: jest.fn(),
            update: jest.fn(),
        },
        productBatch: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
        $transaction: jest.fn(),
    };

    mockPrisma.$transaction.mockImplementation((callback: any) => callback(mockPrisma));

    return {
        __esModule: true,
        default: mockPrisma,
    };
});

jest.mock('@/lib/notificationService', () => ({
    checkLowStockProducts: jest.fn().mockResolvedValue(undefined),
    checkDebtDue: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/batch.service', () => ({
    BatchService: {
        deductStock: jest.fn().mockResolvedValue([{ batchId: 'batch-1', deducted: 2, cost: 5000 }]),
    }
}));

// Mock withAuth middleware
jest.mock('@/lib/api-middleware', () => ({
    withAuth: (handler: any) => async (req: NextRequest) => {
        const session = { user: { id: 'user-1', email: 'test@example.com', storeId: 'store-1' } };
        const storeId = 'store-1';
        return handler(req, session, storeId);
    },
}));

jest.mock('@/lib/store-access', () => ({
    validateStoreAccess: jest.fn().mockResolvedValue({ valid: true, role: 'OWNER' }),
    hasPermission: jest.fn().mockReturnValue(true),
}));

describe('Transactions API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('GET /api/transactions', () => {
        it('should return list of transactions for store', async () => {
            const mockTransactions = [
                { id: 'tx-1', total: 10000, storeId: 'store-1', items: [] },
            ];

            (prismaMock.transaction.findMany as jest.Mock).mockResolvedValue(mockTransactions);
            (prismaMock.transaction.count as jest.Mock).mockResolvedValue(0);

            const req = new NextRequest('http://localhost:3000/api/transactions');
            const res = await GET(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.transactions).toEqual(mockTransactions);
            expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { storeId: 'store-1' }
            }));
        });
    });

    describe('POST /api/transactions', () => {
        it('should create transaction and update stock', async () => {
            const transactionData = {
                items: [
                    { productId: 'prod-1', quantity: 2, price: 5000 }
                ],
                paymentMethod: 'CASH',
                paymentDetails: [{ amount: 10000, method: 'CASH' }]
            };

            const mockProduct = { id: 'prod-1', name: 'Product 1', stock: 10, threshold: 5, supplierId: 'sup-1', storeId: 'store-1', price: 10000, purchase_price: 5000 };
            const createdTx = { id: 'tx-new', total: 10000 };

            // Mock prisma calls
            (prismaMock.transaction.count as jest.Mock).mockResolvedValue(0);
            (prismaMock.product.findFirst as jest.Mock).mockResolvedValue(mockProduct);
            (prismaMock.product.update as jest.Mock).mockResolvedValue({ ...mockProduct, stock: 8 });
            (prismaMock.transaction.create as jest.Mock).mockResolvedValue(createdTx);
            (prismaMock.transactionItem.create as jest.Mock).mockResolvedValue({ id: 'item-1' });

            const req = new NextRequest('http://localhost:3000/api/transactions', {
                method: 'POST',
                body: JSON.stringify(transactionData),
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(201);
            expect(data.transaction).toEqual(createdTx);

            // Verify stock update logic (BatchService handles it)
            // expect(prismaMock.product.update).toHaveBeenCalledWith(...) // Removed as BatchService is mocked
            expect(BatchService.deductStock).toHaveBeenCalledWith('prod-1', 2, expect.anything());
        });

        it('should create transaction with customerId', async () => {
            const transactionData = {
                items: [
                    { productId: 'prod-1', quantity: 2, price: 5000 }
                ],
                paymentMethod: 'CASH',
                paymentDetails: [{ amount: 10000, method: 'CASH' }],
                customerId: 'cust-1'
            };

            const mockProduct = { id: 'prod-1', name: 'Product 1', stock: 10, threshold: 5, supplierId: 'sup-1', storeId: 'store-1', price: 10000, purchase_price: 5000 };
            const createdTx = { id: 'tx-new', total: 10000, customerId: 'cust-1' };

            // Mock prisma calls
            (prismaMock.product.findFirst as jest.Mock).mockResolvedValue(mockProduct);
            (prismaMock.product.update as jest.Mock).mockResolvedValue({ ...mockProduct, stock: 8 });
            (prismaMock.transaction.create as jest.Mock).mockResolvedValue(createdTx);
            (prismaMock.transactionItem.create as jest.Mock).mockResolvedValue({ id: 'item-1' });

            const req = new NextRequest('http://localhost:3000/api/transactions', {
                method: 'POST',
                body: JSON.stringify(transactionData),
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(201);
            expect(data.transaction).toEqual(createdTx);
            expect(prismaMock.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    customerId: 'cust-1'
                })
            }));
        });

        it('should handle manual discount correctly', async () => {
            const transactionData = {
                items: [
                    { productId: 'prod-1', quantity: 1, price: 10000 }
                ],
                paymentMethod: 'CASH',
                paymentDetails: [{ amount: 9000, method: 'CASH' }], // 10k - 1k discount = 9k to pay
                discount: 1000
            };

            const mockProduct = { id: 'prod-1', name: 'Product 1', stock: 10, threshold: 5, supplierId: 'sup-1', storeId: 'store-1', price: 10000, purchase_price: 5000 };
            // Service should yield net total 9000
            const createdTx = { id: 'tx-discount', total: 9000, discount: 1000, paymentStatus: 'PAID' };

            (prismaMock.product.findFirst as jest.Mock).mockResolvedValue(mockProduct);
            (prismaMock.transaction.create as jest.Mock).mockResolvedValue(createdTx);
            (prismaMock.transactionItem.create as jest.Mock).mockResolvedValue({ id: 'item-1' });

            const req = new NextRequest('http://localhost:3000/api/transactions', {
                method: 'POST',
                body: JSON.stringify(transactionData),
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(201);
            expect(data.transaction).toEqual(createdTx);
            
            // Verify TransactionService logic via Prisma call
            expect(prismaMock.transaction.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    total: 9000, // Net
                    discount: 1000,
                    amountPaid: 9000
                })
            }));
        });

        it('should fail if stock is insufficient', async () => {
            const transactionData = {
                items: [
                    { productId: 'prod-1', quantity: 20, price: 5000 }
                ],
                paymentMethod: 'CASH',
                paymentDetails: [{ amount: 100000, method: 'CASH' }]
            };

            const mockProduct = { id: 'prod-1', name: 'Product 1', stock: 10, storeId: 'store-1', price: 10000, purchase_price: 5000 };

            (prismaMock.product.findFirst as jest.Mock).mockResolvedValue(mockProduct);
            
            // Mock BatchService to throw
            (BatchService.deductStock as jest.Mock).mockRejectedValueOnce(new Error('Not enough stock for product Product 1'));

            const req = new NextRequest('http://localhost:3000/api/transactions', {
                method: 'POST',
                body: JSON.stringify(transactionData),
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(400); // Business error
            expect(data.error).toBe('Not enough stock for product Product 1');
        });

        it('should fail if payment is insufficient', async () => {
            const transactionData = {
                items: [
                    { productId: 'prod-1', quantity: 1, price: 5000 }
                ],
                paymentMethod: 'CASH',
                paymentDetails: [{ amount: 4000, method: 'CASH' }] // Less than 5000
            };

            const req = new NextRequest('http://localhost:3000/api/transactions', {
                method: 'POST',
                body: JSON.stringify(transactionData),
            });

            const res = await POST(req);
            await res.json();

            expect(res.status).toBe(400); // Matches business error logic
            // Checking implementaton: it throws "Total pembayaran kurang..." which is not in the "isBusinessError" list in route.ts?
            // Let's check route.ts logic: 
            // const isBusinessError = error.message && (error.message.includes('stock') || error.message.includes('total') ...);
            // Wait, "Total pembayaran kurang..." contains "total". So it might be 400.
        });
    });
});
