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
        storeAccess: {
            findUnique: jest.fn(),
        },
        user: {
            update: jest.fn(),
        }
    },
}));

describe('Switch Store API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createRequest = (body: any) => {
        return new NextRequest('http://localhost:3000/api/auth/switch-store', {
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

    it('should return 400 if storeId is missing', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
        const req = createRequest({});
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it('should return 403 if user has no access', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
        (prismaMock.storeAccess.findUnique).mockResolvedValue(null);

        const req = createRequest({ storeId: 'store-1' });
        const res = await POST(req);
        expect(res.status).toBe(403);
    });

    it('should switch store successfully', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
        (prismaMock.storeAccess.findUnique).mockResolvedValue({
            userId: 'user-1',
            storeId: 'store-1',
            role: 'OWNER',
            store: { name: 'Store 1' }
        });
        (prismaMock.user.update).mockResolvedValue({});

        const req = createRequest({ storeId: 'store-1' });
        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(prismaMock.user.update).toHaveBeenCalledWith({
            where: { id: 'user-1' },
            data: { storeId: 'store-1', role: 'OWNER' }
        });
    });
});
