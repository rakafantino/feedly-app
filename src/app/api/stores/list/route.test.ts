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
        storeAccess: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
        },
        store: {
            findUnique: jest.fn(),
        },
        user: {
            findUnique: jest.fn(),
        }
    },
}));

describe('Store List API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });



    it('should return 401 if unauthorized', async () => {
        (auth as jest.Mock).mockResolvedValue(null);

        const res = await GET();
        expect(res.status).toBe(401);
    });

    it('should return user stores', async () => {
        (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1', email: 'test@example.com' } });

        const mockAccesses = [
            {
                store: { id: 'store-1', name: 'Store 1', isActive: true },
                role: 'OWNER'
            }
        ];

        (prismaMock.storeAccess.findMany).mockResolvedValue(mockAccesses);


        const res = await GET();
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.data).toHaveLength(1);
        expect(data.data[0].id).toBe('store-1');
    });

    it('should handle self-healing legacy store access', async () => {
        // Simulate user with storeId in session but no Access record
        (auth as jest.Mock).mockResolvedValue({
            user: { id: 'user-1', email: 'test@example.com', storeId: 'legacy-store' }
        });

        // No access found initially
        (prismaMock.storeAccess.findUnique).mockResolvedValue(null);
        // Store exists
        (prismaMock.store.findUnique).mockResolvedValue({ id: 'legacy-store' });
        // findMany returns empty initially (or mocked separately, logic runs before findMany)
        (prismaMock.storeAccess.findMany).mockResolvedValue([]);


        await GET();

        // Should attempt to create access
        expect(prismaMock.storeAccess.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                userId: 'user-1',
                storeId: 'legacy-store'
            })
        });
    });
});
