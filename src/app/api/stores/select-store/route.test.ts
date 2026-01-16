/**
 * @jest-environment node
 */
import { POST } from './route';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
    __esModule: true,
    default: {
        store: { findUnique: jest.fn() },
        user: {
            findUnique: jest.fn(),
            update: jest.fn()
        }
    },
}));

describe('Select Store API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createRequest = (body: any) => {
        return new NextRequest('http://localhost:3000/api/stores/select-store', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    };

    it('should return 401 if unauthorized', async () => {
        (auth as jest.Mock).mockResolvedValue(null);
        const req = createRequest({ storeId: 'store-1' });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it('should return 404 if store not found or inactive', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
        (prismaMock.store.findUnique).mockResolvedValue(null);
        const req = createRequest({ storeId: 'invalid' });
        const res = await POST(req);
        expect(res.status).toBe(404);
    });

    it('should return 403 if user has no access (non-admin)', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1', role: 'user' } });
        (prismaMock.store.findUnique).mockResolvedValue({ id: 'store-1', isActive: true });
        // UserAccess check fails -> findUnique returns null for (userId, storeId) match check in User model?
        // Wait, implementation checks `prisma.user.findUnique({ where: { id: userId, storeId: storeId } })`? 
        // This logic in implementation seems to verify if current associated store matches? 
        // OR it might mean checking if specific relational field exists? 
        // Ah, prisma `findUnique` with `where: { id: userId, storeId: storeId }` implies verifying the user record MATCHES that storeId?
        // Looking at implementation: `const user = await prisma.user.findUnique({ where: { id: userId, storeId: storeId } });`
        // This looks like it checks if the user's CURRENT storeId matches the requested one? 
        // ACTUALLY, checking the code provided:
        // It verifies if the user *belongs* to the store? NO, wait.
        // If the implementation uses `findUnique` on `User` with `storeId` filter, it implies `storeId` is a field on User.
        // If access is managed via `StoreAccess` table, simply checking `User.storeId` might verify if they are *currently* assigned, but not if they *can* be assigned.
        // However, for the purpose of the TEST, I must mock exactly what the logic calls.

        (prismaMock.user.findUnique).mockResolvedValue(null); // Simulate "no access" per logic

        const req = createRequest({ storeId: 'store-1' });
        const res = await POST(req);
        expect(res.status).toBe(403);
    });

    it('should select store successfully (admin)', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } });
        (prismaMock.store.findUnique).mockResolvedValue({ id: 'store-1', isActive: true });

        const req = createRequest({ storeId: 'store-1' });
        const res = await POST(req);

        expect(res.status).toBe(200);
        // Should set cookie (we can check cookies in response)
        expect(res.cookies.get('selectedStoreId')).toBeDefined();
    });
});
