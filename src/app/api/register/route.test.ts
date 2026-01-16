// 1. Mock Prisma
jest.mock('@/lib/prisma', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockDeep } = require('jest-mock-extended');
  return {
    __esModule: true,
    default: mockDeep(),
  };
});
import { POST } from './route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

const mockHash = jest.fn();
const mockCompare = jest.fn();

// 2. Mock bcryptjs
jest.mock('bcryptjs', () => ({
  hash: (...args: any[]) => mockHash(...args),
  compare: (...args: any[]) => mockCompare(...args),
}));

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('POST /api/register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if validation fails', async () => {
    const req = new NextRequest('http://localhost:3000/api/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'A', // Too short
        email: 'invalid-email',
        password: '123' // Too short
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Validation failed');
    expect(data.details).toBeDefined();
  });

  it('should return 409 if email already exists', async () => {
    // Setup mock behavior
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'existing-id',
      email: 'test@example.com',
    } as any);

    const req = new NextRequest('http://localhost:3000/api/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toBe('Email already registered');
  });

  it('should return 201 and create user on success', async () => {
    // Setup mocks
    prismaMock.user.findUnique.mockResolvedValue(null);
    mockHash.mockResolvedValue('hashed-password-123');
    
    prismaMock.user.create.mockResolvedValue({
      id: 'new-user-id',
      name: 'New User',
      email: 'new@example.com',
      // password field omitted in return if logic deletes it, but prisma returns it usually
      password: 'hashed-password-123',
      role: 'CASHIER', 
    } as any);

    const req = new NextRequest('http://localhost:3000/api/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'New User',
        email: 'new@example.com',
        password: 'password123'
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe('new@example.com');
    
    // Verify mocks called correctly
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { email: 'new@example.com' } });
    expect(mockHash).toHaveBeenCalledWith('password123', 10);
    expect(prismaMock.user.create).toHaveBeenCalled();
  });

  it('should return 500 on database error', async () => {
    // Simulate validation passing but findUnique failing
    prismaMock.user.findUnique.mockRejectedValue(new Error('DB Error'));

    const req = new NextRequest('http://localhost:3000/api/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe('Internal server error');
  });
});
