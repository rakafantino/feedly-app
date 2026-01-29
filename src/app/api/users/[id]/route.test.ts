/**
 * @jest-environment node
 */
import { PATCH, DELETE } from './route';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import bcryptjs from 'bcryptjs';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

jest.mock('bcryptjs', () => ({
    hash: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
    __esModule: true,
    default: {
        user: {
            findUnique: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
    },
}));

describe('Users [ID] API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createRequest = (method: string, body?: any) => {
        const req = new NextRequest('http://localhost:3000/api/users/u-1', {
            method,
            body: body ? JSON.stringify(body) : undefined,
        });
        return req;
    };

    // Params mock helper
    const params = Promise.resolve({ id: 'u-1' });

    describe('PATCH', () => {
        it('should return 401 if unauthorized', async () => {
            (auth as jest.Mock).mockResolvedValue(null);
            const req = createRequest('PATCH', {});
            const res = await PATCH(req, { params });
            expect(res.status).toBe(401);
        });

        it('should return 403 if not owner', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1', role: 'CASHIER' } });
            const req = createRequest('PATCH', {});
            const res = await PATCH(req, { params });
            expect(res.status).toBe(403);
        });

        it('should update user successfully', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1', role: 'OWNER' } });
            (prismaMock.user.findUnique).mockResolvedValue({ id: 'u-1', storeId: 'store-1', role: 'CASHIER' });
            (prismaMock.user.update).mockResolvedValue({ id: 'u-1', name: 'New Name' });

            const req = createRequest('PATCH', { name: 'New Name' });
            const res = await PATCH(req, { params });
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.data.name).toBe('New Name');
        });

        it('should hash password if provided', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1', role: 'OWNER' } });
            (prismaMock.user.findUnique).mockResolvedValue({ id: 'u-1', storeId: 'store-1' });
            (bcryptjs.hash as jest.Mock).mockResolvedValue('hashed_secret');
            (prismaMock.user.update).mockResolvedValue({ id: 'u-1' });

            const req = createRequest('PATCH', { password: 'secretpassword' });
            await PATCH(req, { params });

            expect(bcryptjs.hash).toHaveBeenCalledWith('secretpassword', 10);
        });
    });

    describe('DELETE', () => {
        it('should return 403 if not owner', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1', role: 'CASHIER' } }); // Cashier cannot delete
            const req = createRequest('DELETE');
            const res = await DELETE(req, { params });
            expect(res.status).toBe(403);
        });

        it('should delete user if owner', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { id: 'owner-1', storeId: 'store-1', role: 'OWNER' } });
            (prismaMock.user.findUnique).mockResolvedValue({ id: 'u-1', storeId: 'store-1' });
            (prismaMock.user.delete).mockResolvedValue({ id: 'u-1' });

            const req = createRequest('DELETE');
            const res = await DELETE(req, { params });

            expect(res.status).toBe(200);
            expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { id: 'u-1' } });
        });

        it('should prevent self deletion', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { id: 'u-1', storeId: 'store-1', role: 'OWNER' } });

            const req = createRequest('DELETE');
            const res = await DELETE(req, { params });
            expect(res.status).toBe(400);
        });
    });
});
