/**
 * @jest-environment node
 */
import { GET } from './route';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

jest.mock('@/lib/auth', () => ({
    auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
    __esModule: true,
    default: {
        store: { findMany: jest.fn() },
        user: { findUnique: jest.fn() }
    },
}));

describe('User Stores API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return 401 if unauthorized', async () => {
        (auth as jest.Mock).mockResolvedValue(null);
        const res = await GET();
        expect(res.status).toBe(401);
    });

    it('should return all stores for admin', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'admin-1', role: 'admin' } });
        (prismaMock.store.findMany).mockResolvedValue([{ id: 's1', name: 'S1' }]);

        const res = await GET();
        const data = await res.json();

        expect(data.stores).toHaveLength(1);
        expect(prismaMock.store.findMany).toHaveBeenCalled();
    });

    it('should return user store for normal user', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'u1', role: 'user' } });
        (prismaMock.user.findUnique).mockResolvedValue({
            store: { id: 's1', isActive: true }
        });

        const res = await GET();
        const data = await res.json();

        expect(data.stores).toHaveLength(1);
        expect(data.stores[0].id).toBe('s1');
    });
});
