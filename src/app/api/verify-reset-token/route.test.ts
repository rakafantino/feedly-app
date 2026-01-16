/**
 * @jest-environment node
 */
import { GET } from './route';
import prisma from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('@/lib/prisma', () => ({
    __esModule: true,
    default: {
        passwordReset: {
            findFirst: jest.fn(),
        }
    },
}));

describe('Verify Reset Token API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createRequest = (token?: string) => {
        const url = `http://localhost:3000/api/verify-reset-token${token ? `?token=${token}` : ''}`;
        return new NextRequest(url);
    };

    it('should return 400 if token is missing', async () => {
        const req = createRequest();
        const res = await GET(req);
        const data = await res.json();
        expect(res.status).toBe(400);
        expect(data.error).toBe("Token tidak ditemukan");
    });

    it('should return 400 if token is invalid or expired', async () => {
        (prismaMock.passwordReset.findFirst).mockResolvedValue(null);
        const req = createRequest('invalid-token');
        const res = await GET(req);
        const data = await res.json();
        expect(res.status).toBe(400);
        expect(data.valid).toBe(false);
    });

    it('should return 200 and email if token is valid', async () => {
        (prismaMock.passwordReset.findFirst).mockResolvedValue({
            id: 'reset-1',
            userId: 'user-1',
            user: { email: 'test@example.com' }
        });
        const req = createRequest('valid-token');
        const res = await GET(req);
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.valid).toBe(true);
        expect(data.email).toBe('test@example.com');
    });
});
