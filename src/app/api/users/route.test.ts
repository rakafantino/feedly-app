/**
 * @jest-environment node
 */
import { GET, POST } from './route';
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
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
        },
    },
}));

describe('Users API', () => {
    const prismaMock = prisma as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/users', () => {
        it('should return 401 if unauthorized', async () => {
            (auth as jest.Mock).mockResolvedValue(null);
            const res = await GET();
            // route.ts: export async function GET() { ... } - IT DOES NOT TAKE REQ! 
            // Wait, let me check the file content trace.
            // Line 17: export async function GET() {
            // It doesn't take 'req' argument in the signature shown in step 1492!
            // But usually Next.js route handlers take (req).
            // Logic uses `req.cookies` only if `session` fallback fails? 
            // Line 19: const session = await auth();
            // It does NOT use `req` in the provided snippet for GET.
            // So calling GET() without args is correct based on the file content.

            expect(res.status).toBe(401);
        });

        it('should return 403 if role is CASHIER', async () => {
            (auth as jest.Mock).mockResolvedValue({
                user: { storeId: 'store-1', role: 'CASHIER' }
            });

            const res = await GET(); // Logic doesn't use req
            expect(res.status).toBe(403);
        });

        it('should return users list for OWNER', async () => {
            (auth as jest.Mock).mockResolvedValue({
                user: { storeId: 'store-1', role: 'OWNER' }
            });

            const mockUsers = [{ id: 'u1', name: 'User 1' }];
            (prismaMock.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

            const res = await GET();
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.data).toEqual(mockUsers);
        });
    });

    describe('POST /api/users', () => {
        // POST takes req: export async function POST(req: NextRequest)

        it('should create new user if allowed', async () => {
            (auth as jest.Mock).mockResolvedValue({
                user: { storeId: 'store-1', role: 'OWNER' }
            });
            (prismaMock.user.findUnique as jest.Mock).mockResolvedValue(null); // Email not taken
            (bcryptjs.hash as jest.Mock).mockResolvedValue('hashed_pw');
            (prismaMock.user.create as jest.Mock).mockResolvedValue({ id: 'new-u', name: 'New User' });

            const newUser = {
                name: 'New User',
                email: 'new@example.com',
                password: 'password123',
                role: 'CASHIER'
            };

            const req = new NextRequest('http://localhost:3000/api/users', {
                method: 'POST',
                body: JSON.stringify(newUser)
            });

            const res = await POST(req);
            await res.json();

            expect(res.status).toBe(201);
            expect(prismaMock.user.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    email: 'new@example.com',
                    password: 'hashed_pw',
                    storeId: 'store-1'
                })
            }));
        });

        it('should return 409 if email already exists', async () => {
            (auth as jest.Mock).mockResolvedValue({
                user: { storeId: 'store-1', role: 'OWNER' }
            });
            (prismaMock.user.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

            const newUser = {
                name: 'User',
                email: 'taken@example.com',
                password: 'password',
                role: 'CASHIER'
            };

            const req = new NextRequest('http://localhost:3000/api/users', {
                method: 'POST',
                body: JSON.stringify(newUser)
            });

            const res = await POST(req);
            expect(res.status).toBe(409);
        });
    });
});
