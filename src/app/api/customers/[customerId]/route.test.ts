/**
 * @jest-environment node
 */
import { GET, PATCH, DELETE } from './route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

// Mock dependencies
jest.mock('@/lib/api-middleware', () => ({
    withAuth: jest.fn((handler) => (req: any, session: any, storeId: string) => handler(req, session, storeId))
}));

jest.mock('@/lib/prisma', () => {
    const mockPrisma = {
        customer: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
    };
    return {
        __esModule: true,
        default: mockPrisma,
    };
});

describe('Customer ID API', () => {
    const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        role: 'OWNER',
        storeId: 'store-1',
    };

    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/customers/[customerId]', () => {
        it('should return a customer by ID', async () => {
            const mockCustomer = {
                id: 'cust-1',
                name: 'Pak Budi',
                storeId: 'store-1',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            (prismaMock.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer);

            const req = new NextRequest('http://localhost:3000/api/customers/cust-1');
            const session = { user: mockUser };
            const storeId = 'store-1';

            const res = await (GET as any)(req, session, storeId);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data).toEqual({
                ...mockCustomer,
                createdAt: mockCustomer.createdAt.toISOString(),
                updatedAt: mockCustomer.updatedAt.toISOString(),
            });
            expect(prismaMock.customer.findFirst).toHaveBeenCalledWith({
                where: { id: 'cust-1', storeId: 'store-1' },
            });
        });

        it('should return 400 if storeId is missing', async () => {
            const req = new NextRequest('http://localhost:3000/api/customers/cust-1');
            const session = { user: mockUser };
            const res = await (GET as any)(req, session, null);
            expect(res.status).toBe(400);
        });
    });

    describe('PATCH /api/customers/[customerId]', () => {
        it('should update a customer', async () => {
            const updateData = { name: 'Pak Budi Updated' };
            const updatedCustomer = {
                id: 'cust-1',
                name: 'Pak Budi Updated',
                storeId: 'store-1',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            (prismaMock.customer.findFirst as jest.Mock).mockResolvedValue(updatedCustomer);
            (prismaMock.customer.update as jest.Mock).mockResolvedValue(updatedCustomer);

            const req = new NextRequest('http://localhost:3000/api/customers/cust-1', {
                method: 'PATCH',
                body: JSON.stringify(updateData),
            });
            const session = { user: mockUser };
            const storeId = 'store-1';

            const res = await (PATCH as any)(req, session, storeId);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data).toEqual({
                ...updatedCustomer,
                createdAt: updatedCustomer.createdAt.toISOString(),
                updatedAt: updatedCustomer.updatedAt.toISOString(),
            });
            expect(prismaMock.customer.findFirst).toHaveBeenCalledWith({
                where: { id: 'cust-1', storeId: 'store-1' },
            });
            expect(prismaMock.customer.update).toHaveBeenCalledWith({
                where: { id: 'cust-1' },
                data: updateData,
            });
        });
    });

    describe('DELETE /api/customers/[customerId]', () => {
        it('should delete a customer', async () => {
            const deletedCustomer = {
                id: 'cust-1',
                name: 'Pak Budi',
                storeId: 'store-1',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            (prismaMock.customer.findFirst as jest.Mock).mockResolvedValue(deletedCustomer);
            (prismaMock.customer.delete as jest.Mock).mockResolvedValue(deletedCustomer);

            const req = new NextRequest('http://localhost:3000/api/customers/cust-1', {
                method: 'DELETE',
            });
            const session = { user: mockUser };
            const storeId = 'store-1';

            const res = await (DELETE as any)(req, session, storeId);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data).toEqual({
                ...deletedCustomer,
                createdAt: deletedCustomer.createdAt.toISOString(),
                updatedAt: deletedCustomer.updatedAt.toISOString(),
            });
            expect(prismaMock.customer.findFirst).toHaveBeenCalledWith({
                where: { id: 'cust-1', storeId: 'store-1' },
            });
            expect(prismaMock.customer.delete).toHaveBeenCalledWith({
                where: { id: 'cust-1' },
            });
        });
    });
});
