/**
 * @jest-environment node
 */
import { GET, POST } from './route';
import prisma from '@/lib/prisma';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
    __esModule: true,
    default: {
        supplier: {
            findMany: jest.fn(),
            create: jest.fn(),
        },
    },
}));

// Mock withAuth middleware
jest.mock('@/lib/api-middleware', () => ({
    withAuth: (handler: any) => async (req: NextRequest) => {
        // Mock user session and storeId
        const session = { user: { id: 'user-1', email: 'test@example.com' } };
        const storeId = 'store-1';
        return handler(req, session, storeId);
    },
}));

describe('Suppliers API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/suppliers', () => {
        it('should return list of suppliers filtered by storeId', async () => {
            const mockSuppliers = [
                { id: '1', name: 'Supplier A', storeId: 'store-1' },
            ];

            (prismaMock.supplier.findMany as jest.Mock).mockResolvedValue(mockSuppliers);

            const req = new NextRequest('http://localhost:3000/api/suppliers');
            const res = await GET(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.suppliers).toEqual(mockSuppliers);
            expect(prismaMock.supplier.findMany).toHaveBeenCalledWith(expect.objectContaining({
                where: { storeId: 'store-1' }
            }));
        });

        it('should handle db error gracefully', async () => {
            (prismaMock.supplier.findMany as jest.Mock).mockRejectedValue(new Error('DB Error'));

            const req = new NextRequest('http://localhost:3000/api/suppliers');
            const res = await GET(req);

            expect(res.status).toBe(500);
        });
    });

    describe('POST /api/suppliers', () => {
        it('should create a new supplier with valid data', async () => {
            const newSupplierData = {
                name: 'New Supplier',
                email: 'supplier@example.com',
                phone: '08123',
                address: 'Jalan ABC',
            };

            const createdSupplier = { id: 'new-1', ...newSupplierData, storeId: 'store-1' };

            (prismaMock.supplier.create as jest.Mock).mockResolvedValue(createdSupplier);

            const req = new NextRequest('http://localhost:3000/api/suppliers', {
                method: 'POST',
                body: JSON.stringify(newSupplierData),
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(201);
            expect(data.supplier).toEqual(createdSupplier);
            expect(prismaMock.supplier.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    ...newSupplierData,
                    storeId: 'store-1'
                })
            }));
        });

        it('should return 400 if validation fails', async () => {
            const invalidData = {
                name: 123, // Invalid type
            };

            const req = new NextRequest('http://localhost:3000/api/suppliers', {
                method: 'POST',
                body: JSON.stringify(invalidData),
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(400);
            expect(data.error).toContain('Validasi gagal');
        });
    });
});
