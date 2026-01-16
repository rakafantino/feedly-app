/**
 * @jest-environment node
 */
import { GET } from './route';
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
        transaction: {
            findUnique: jest.fn(),
        },
    },
}));

describe('Transactions [ID] API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createRequest = () => {
        const req = new NextRequest('http://localhost:3000/api/transactions/tx-1');
        Object.defineProperty(req, 'nextUrl', {
            value: { pathname: '/api/transactions/tx-1' }
        });
        return req;
    };

    describe('GET', () => {
        it('should return 401 if unauthorized', async () => {
            (auth as jest.Mock).mockResolvedValue(null);
            const req = createRequest();
            const res = await GET(req);
            expect(res.status).toBe(401);
        });

        it('should return 404 if transaction not found', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });
            (prismaMock.transaction.findUnique).mockResolvedValue(null);

            const req = createRequest();
            const res = await GET(req);
            expect(res.status).toBe(404);
        });

        it('should return transaction details', async () => {
            (auth as jest.Mock).mockResolvedValue({ user: { storeId: 'store-1' } });
            const mockTx = {
                id: 'tx-1',
                total: 10000,
                items: [{ product: { name: 'Prod A' } }]
            };
            (prismaMock.transaction.findUnique).mockResolvedValue(mockTx);

            const req = createRequest();
            const res = await GET(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.transaction).toEqual(mockTx);
            expect(prismaMock.transaction.findUnique).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({
                    id: 'tx-1',
                    storeId: 'store-1'
                })
            }));
        });
    });
});
