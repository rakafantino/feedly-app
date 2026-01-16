/**
 * @jest-environment node
 */
import { POST } from './route';
import prisma from '@/lib/prisma';
import { NextRequest } from 'next/server';
import bcryptjs from 'bcryptjs';

jest.mock('@/lib/prisma', () => ({
    __esModule: true,
    default: {
        passwordReset: {
            findFirst: jest.fn(),
            delete: jest.fn(),
        },
        user: {
            update: jest.fn(),
        }
    },
}));

jest.mock('bcryptjs', () => ({
    hash: jest.fn(),
}));

describe('Reset Password API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const createRequest = (body: any) => {
        return new NextRequest('http://localhost:3000/api/reset-password', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    };

    it('should return 400 if missing fields', async () => {
        const req = createRequest({ token: 'abc' }); // missing password
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it('should return 400 if password too short', async () => {
        const req = createRequest({ token: 'abc', password: '123' });
        const res = await POST(req);
        const data = await res.json();
        expect(res.status).toBe(400);
        expect(data.error).toBe('Password minimal 6 karakter');
    });

    it('should return 400 if token invalid', async () => {
        (prismaMock.passwordReset.findFirst).mockResolvedValue(null);
        const req = createRequest({ token: 'invalid', password: 'newpassword123' });
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it('should reset password successfully', async () => {
        (prismaMock.passwordReset.findFirst).mockResolvedValue({
            id: 'reset-1',
            userId: 'user-1'
        });
        (bcryptjs.hash as jest.Mock).mockResolvedValue('hashed_password');
        (prismaMock.user.update).mockResolvedValue({});
        (prismaMock.passwordReset.delete).mockResolvedValue({});

        const req = createRequest({ token: 'valid', password: 'newpassword123' });
        const res = await POST(req);

        expect(res.status).toBe(200);
        expect(prismaMock.user.update).toHaveBeenCalledWith({
            where: { id: 'user-1' },
            data: { password: 'hashed_password' }
        });
        expect(prismaMock.passwordReset.delete).toHaveBeenCalledWith({
            where: { id: 'reset-1' }
        });
    });
});
