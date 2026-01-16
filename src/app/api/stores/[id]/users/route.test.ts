/**
 * @jest-environment node
 */
import { GET, POST } from './route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';


// Setup Mock for withAuth shim if needed, or assume it passes session
// Since we are unit testing the handler logic wrapped in withAuth, 
// we might need to mock withAuth if it's imported.
// In this case, `route.ts` imports `withAuth`. We need to mock it to just execute the handler.
jest.mock('@/lib/api-middleware', () => ({
    withAuth: jest.fn((handler) => (req: any, session: any) => handler(req, session))
}));

jest.mock('@/lib/prisma', () => ({
    __esModule: true,
    default: {
        store: { findUnique: jest.fn() },
        user: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn()
        }
    },
}));

jest.mock('bcryptjs', () => ({
    hash: jest.fn().mockResolvedValue('hashed_pw')
}));

describe('Store Users [id] API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Helper to create mocked NextRequest with URL containing ID
    // Since request.nextUrl.pathname.split('/')[3] is used in code
    const createRequest = (storeId: string, method: string = 'GET', body: any = null) => {
        const req = new NextRequest(`http://localhost:3000/api/stores/${storeId}/users`, {
            method,
            body: body ? JSON.stringify(body) : undefined
        });
        return req;
    };

    describe('GET', () => {
        it('should return 403 if non-admin tries to view other store', async () => {
            const req = createRequest('store-2');
            const session = { user: { role: 'user', storeId: 'store-1' } };

            const res = await (GET as any)(req, session);
            expect(res.status).toBe(403);
        });

        it('should return users for admin', async () => {
            const req = createRequest('store-1');
            const session = { user: { role: 'admin' } };

            (prismaMock.store.findUnique).mockResolvedValue({ id: 'store-1' });
            (prismaMock.user.findMany).mockResolvedValue([{ id: 'u1' }]);

            const res = await (GET as any)(req, session);
            const data = await res.json();

            expect(data.users).toHaveLength(1);
        });
    });

    describe('POST', () => {
        it('should return 403 if non-admin tries to create user', async () => {
            const req = createRequest('store-1', 'POST', {});
            const session = { user: { role: 'manager' } }; // Not admin

            const res = await (POST as any)(req, session);
            expect(res.status).toBe(403);
        });

        it('should create user successfully', async () => {
            const req = createRequest('store-1', 'POST', {
                name: 'New User',
                email: 'new@example.com',
                password: 'password',
                role: 'CASHIER'
            });
            const session = { user: { role: 'admin' } };

            (prismaMock.store.findUnique).mockResolvedValue({ id: 'store-1' });
            (prismaMock.user.findUnique).mockResolvedValue(null); // Email not taken
            (prismaMock.user.create).mockResolvedValue({ id: 'u1' });

            const res = await (POST as any)(req, session);
            await res.json();

            expect(res.status).toBe(201);
            expect(prismaMock.user.create).toHaveBeenCalled();
        });
    });
});
