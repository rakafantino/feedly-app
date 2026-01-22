/**
 * @jest-environment node
 */
import { GET, POST } from './route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

// Mock dependencies
// Update mock to match the signature: handler(req, session, storeId)
jest.mock('@/lib/api-middleware', () => ({
    withAuth: jest.fn((handler) => (req: any, session: any, storeId: string) => handler(req, session, storeId))
}));

jest.mock('@/lib/prisma', () => {
    const mockPrisma = {
        customer: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
        },
    };
    return {
        __esModule: true,
        default: mockPrisma,
    };
});

describe('Customer API', () => {
    const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        role: 'OWNER',
        storeId: 'store-1', // user's store
    };

    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/customers', () => {
        it('should create a new customer', async () => {
            const newCustomer = {
                name: 'Pak Budi',
                phone: '08123456789',
                address: 'Jl. Merdeka No. 1',
            };

            const createdCustomer = {
                id: 'cust-1',
                storeId: 'store-1',
                ...newCustomer,
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            (prismaMock.customer.create as jest.Mock).mockResolvedValue(createdCustomer);

            const req = new NextRequest('http://localhost:3000/api/customers', {
                method: 'POST',
                body: JSON.stringify(newCustomer),
            });

            // Call with mocked arguments: (req, session, storeId)
            const session = { user: mockUser };
            const storeId = 'store-1';

            const res = await (POST as any)(req, session, storeId);
            const data = await res.json();

            expect(res.status).toBe(201);
            expect(data).toEqual({
                ...createdCustomer,
                createdAt: createdCustomer.createdAt.toISOString(),
                updatedAt: createdCustomer.updatedAt.toISOString(),
            });
            expect(prismaMock.customer.create).toHaveBeenCalledWith({
                data: {
                    ...newCustomer,
                    storeId: 'store-1',
                },
            });
        });

        it('should return 400 if validation fails', async () => {
            const req = new NextRequest('http://localhost:3000/api/customers', {
                method: 'POST',
                body: JSON.stringify({ phone: '123' }), // Missing name
            });

            const session = { user: mockUser };
            const storeId = 'store-1';

            const res = await (POST as any)(req, session, storeId);
            expect(res.status).toBe(400);
        });

        // Note: Auth failure is handled by withAuth middleware, so we don't strictly catch 401 here 
        // unless we test withAuth logic or if the handler somehow checks it again.
        // Our handler relies on withAuth/storeId.
        it('should return 400 if storeId is missing (middleware bypass simulation)', async () => {
            const req = new NextRequest('http://localhost:3000/api/customers', {
                method: 'POST',
                body: JSON.stringify({ name: 'Test' }),
            });
            const session = { user: mockUser };
            const res = await (POST as any)(req, session, null); // storeId null
            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/customers', () => {
        it('should return list of customers', async () => {
            const mockCustomers = [
                { id: '1', name: 'Cust 1', storeId: 'store-1' },
                { id: '2', name: 'Cust 2', storeId: 'store-1' },
            ];

            (prismaMock.customer.findMany as jest.Mock).mockResolvedValue(mockCustomers);

            const req = new NextRequest('http://localhost:3000/api/customers');
            const session = { user: mockUser };
            const storeId = 'store-1';

            const res = await (GET as any)(req, session, storeId);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data).toEqual(mockCustomers);
            expect(prismaMock.customer.findMany).toHaveBeenCalledWith({
                where: { storeId: 'store-1' },
                orderBy: { createdAt: 'desc' },
            });
        });
    });
});
