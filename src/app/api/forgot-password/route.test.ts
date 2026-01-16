// 1. Mock Prisma
jest.mock('@/lib/prisma', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockDeep } = require('jest-mock-extended');
  return {
    __esModule: true,
    default: mockDeep(),
  };
});

/**
 * @jest-environment node
 */
import { POST } from './route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('POST /api/forgot-password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if validation fails', async () => {
    const req = new NextRequest('http://localhost:3000/api/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        email: 'invalid-email',
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });

  it('should return 200 even if user not found (security)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        email: 'notfound@example.com',
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toBeDefined();
    // Should NOT reveal user doesn't exist explicitly in error, but logic returns success message
  });

  it('should create reset token and return 200 on success', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'user@example.com',
      name: 'User',
    } as any;

    prismaMock.user.findUnique.mockResolvedValue(mockUser);
    
    // Mock deleteMany and create
    prismaMock.passwordReset.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.passwordReset.create.mockResolvedValue({
      id: 'reset-123',
      userId: 'user-123',
      token: 'some-token',
      expiresAt: new Date(),
      createdAt: new Date(),
    } as any);

    const req = new NextRequest('http://localhost:3000/api/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        email: 'user@example.com',
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.needToSendEmail).toBe(true);
    expect(data.emailConfig).toBeDefined();
    
    expect(prismaMock.passwordReset.create).toHaveBeenCalled();
  });

  it('should return 500 on database error', async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error('DB Error'));

    const req = new NextRequest('http://localhost:3000/api/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Terjadi kesalahan saat memproses permintaan');
    // Existing code says: "Terjadi kesalahan saat memproses permintaan" or refactored? 
    // I haven't refactored the error message in the file content replacement fully yet, only validation.
    // Let's check `route.ts` content again or assume I kept existing.
    // Actually, in `register` I standardized it. In `forgot-password`, I only swapped validation. 
    // The existing error handling says: "Terjadi kesalahan saat memproses permintaan"
  });
});
