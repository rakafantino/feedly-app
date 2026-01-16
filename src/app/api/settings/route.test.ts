/**
 * @jest-environment node
 */
import { GET, PATCH } from './route';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
    __esModule: true,
    default: {
        store: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    },
}));

describe('Settings API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/settings', () => {
        it('should return 401 if unauthorized', async () => {
            (auth as jest.Mock).mockResolvedValue(null);
            const req = new NextRequest('http://localhost:3000/api/settings');
            const res = await GET(req);
            expect(res.status).toBe(401);
        });

        it('should return 400 if no storeId found', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: null } });
            const req = new NextRequest('http://localhost:3000/api/settings'); // No query param, no cookie
            const res = await GET(req);
            expect(res.status).toBe(400);
        });

        it('should return 404 if store not found', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });
            (prismaMock.store.findUnique as jest.Mock).mockResolvedValue(null);

            const req = new NextRequest('http://localhost:3000/api/settings');
            const res = await GET(req);
            expect(res.status).toBe(404);
        });

        it('should return store settings', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });
            const mockStore = { id: 'store-1', name: 'My Store', dailyTarget: 1000 };
            (prismaMock.store.findUnique as jest.Mock).mockResolvedValue(mockStore);

            const req = new NextRequest('http://localhost:3000/api/settings');
            const res = await GET(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.data).toEqual(mockStore);
        });
    });

    describe('PATCH /api/settings', () => {
        it('should update store settings', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });

            const updatePayload = {
                name: 'Updated Store',
                dailyTarget: '5000', // String from form
            };

            const updatedStore = { id: 'store-1', ...updatePayload, dailyTarget: 5000 };
            (prismaMock.store.update as jest.Mock).mockResolvedValue(updatedStore);

            const req = new NextRequest('http://localhost:3000/api/settings', {
                method: 'PATCH',
                body: JSON.stringify(updatePayload)
            });

            const res = await PATCH(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.data).toEqual(updatedStore);
            expect(prismaMock.store.update).toHaveBeenCalledWith(expect.objectContaining({
                where: { id: 'store-1' },
                data: expect.objectContaining({
                    name: 'Updated Store',
                    dailyTarget: 5000 // casted
                })
            }));
        });
    });
});
