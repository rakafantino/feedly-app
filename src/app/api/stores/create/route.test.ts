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

// Mock transaction
jest.mock('@/lib/prisma', () => ({
    __esModule: true,
    default: {
        $transaction: jest.fn((callback) => callback({
            store: { create: jest.fn() },
            storeAccess: { create: jest.fn() },
            user: { update: jest.fn() }
        })),
        user: {
            findUnique: jest.fn()
        }
    },
}));

describe('Create Store API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createRequest = (body: any) => {
        return new NextRequest('http://localhost:3000/api/stores/create', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    };

    it('should return 401 if unauthorized', async () => {
        (auth as jest.Mock).mockResolvedValue(null);
        const req = createRequest({ name: 'New Store' });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it('should return 400 if validation fails', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { email: 'test@example.com', id: 'user-1' } });
        const req = createRequest({ name: 'ab' }); // Too short
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it('should create store successfully', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { email: 'test@example.com', id: 'user-1' } });

        // Mock Transaction Implementation
        const mockTx = {
            store: { create: jest.fn().mockResolvedValue({ id: 'store-1', name: 'New Store' }) },
            storeAccess: { create: jest.fn() },
            user: { update: jest.fn() }
        };

        (prismaMock.$transaction).mockImplementation((cb: any) => cb(mockTx));

        const req = createRequest({ name: 'New Store', description: 'Test Desc' });
        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(201);
        expect(mockTx.store.create).toHaveBeenCalled();
        expect(mockTx.storeAccess.create).toHaveBeenCalled();
        expect(mockTx.user.update).toHaveBeenCalled();
        expect(data.success).toBe(true);
    });
});
