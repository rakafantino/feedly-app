
// 1. Mock Prisma
jest.mock('@/lib/prisma', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockDeep } = require('jest-mock-extended');
  return {
    __esModule: true,
    default: mockDeep(),
  };
});

// 2. Mock Auth
const mockSession = {
  user: {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    role: 'OWNER',
    storeId: 'store-123'
  }
};

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(() => Promise.resolve(mockSession)),
}));

import { POST, GET } from './route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const authMock = auth as jest.Mock;

describe('/api/expenses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: user is authenticated
    authMock.mockResolvedValue(mockSession as any);
  });

  // =============================
  // POST /api/expenses (Create)
  // =============================
  describe('POST /api/expenses', () => {
    const validExpenseData = {
      amount: 500000,
      category: 'RENT',
      description: 'Monthly rent payment',
      date: '2026-01-15T00:00:00.000Z'
    };

    // ----- EDGE CASES -----
    describe('Edge Cases', () => {
      it('should return 401 if user is unauthenticated', async () => {
        authMock.mockResolvedValueOnce(null);

        const req = new NextRequest('http://localhost:3000/api/expenses', {
          method: 'POST',
          body: JSON.stringify(validExpenseData)
        });

        const res = await POST(req);
        expect(res.status).toBe(401);
      });

      it('should return 400 if amount is missing', async () => {
        const invalidData = { ...validExpenseData, amount: undefined };

        const req = new NextRequest('http://localhost:3000/api/expenses', {
          method: 'POST',
          body: JSON.stringify(invalidData)
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
      });

      it('should return 400 if amount is zero', async () => {
        const invalidData = { ...validExpenseData, amount: 0 };

        const req = new NextRequest('http://localhost:3000/api/expenses', {
          method: 'POST',
          body: JSON.stringify(invalidData)
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
      });

      it('should return 400 if amount is negative', async () => {
        const invalidData = { ...validExpenseData, amount: -10000 };

        const req = new NextRequest('http://localhost:3000/api/expenses', {
          method: 'POST',
          body: JSON.stringify(invalidData)
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
      });

      it('should return 400 if category is missing', async () => {
        const invalidData = { amount: 500000, description: 'Test' };

        const req = new NextRequest('http://localhost:3000/api/expenses', {
          method: 'POST',
          body: JSON.stringify(invalidData)
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
      });

      it('should return 400 if category is empty string', async () => {
        const invalidData = { ...validExpenseData, category: '' };

        const req = new NextRequest('http://localhost:3000/api/expenses', {
          method: 'POST',
          body: JSON.stringify(invalidData)
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
      });

      it('should return 400 if storeId is not available from session', async () => {
        authMock.mockResolvedValueOnce({
          user: { id: 'user-123', name: 'Test', email: 'test@example.com', role: 'OWNER', storeId: null }
        } as any);

        const req = new NextRequest('http://localhost:3000/api/expenses', {
          method: 'POST',
          body: JSON.stringify(validExpenseData)
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
      });

      it('should return 500 on database error', async () => {
        prismaMock.expense.create.mockRejectedValue(new Error('DB Error'));

        const req = new NextRequest('http://localhost:3000/api/expenses', {
          method: 'POST',
          body: JSON.stringify(validExpenseData)
        });

        const res = await POST(req);
        expect(res.status).toBe(500);
      });
    });

    // ----- NORMAL CASES -----
    describe('Normal Cases', () => {
      it('should create an expense successfully', async () => {
        prismaMock.expense.create.mockResolvedValue({
          id: 'expense-1',
          storeId: 'store-123',
          amount: 500000,
          category: 'RENT',
          description: 'Monthly rent payment',
          date: new Date('2026-01-15T00:00:00.000Z'),
          createdById: 'user-123',
          createdAt: new Date(),
          updatedAt: new Date()
        });

        const req = new NextRequest('http://localhost:3000/api/expenses', {
          method: 'POST',
          body: JSON.stringify(validExpenseData)
        });

        const res = await POST(req);
        const data = await res.json();

        expect(res.status).toBe(201);
        expect(data.expense).toBeDefined();
        expect(data.expense.id).toBe('expense-1');
        expect(prismaMock.expense.create).toHaveBeenCalledWith(expect.objectContaining({
          data: expect.objectContaining({
            amount: 500000,
            category: 'RENT',
            storeId: 'store-123',
            createdById: 'user-123'
          })
        }));
      });

      it('should allow creating expense without description', async () => {
        const dataWithoutDesc = { amount: 100000, category: 'UTILITIES' };
        prismaMock.expense.create.mockResolvedValue({
          id: 'expense-2',
          storeId: 'store-123',
          amount: 100000,
          category: 'UTILITIES',
          description: null,
          date: new Date(),
          createdById: 'user-123',
          createdAt: new Date(),
          updatedAt: new Date()
        });

        const req = new NextRequest('http://localhost:3000/api/expenses', {
          method: 'POST',
          body: JSON.stringify(dataWithoutDesc)
        });

        const res = await POST(req);
        expect(res.status).toBe(201);
      });
    });
  });

  // =============================
  // GET /api/expenses (List)
  // =============================
  describe('GET /api/expenses', () => {
    // ----- EDGE CASES -----
    describe('Edge Cases', () => {
      it('should return 401 if user is unauthenticated', async () => {
        authMock.mockResolvedValueOnce(null);

        const req = new NextRequest('http://localhost:3000/api/expenses');

        const res = await GET(req);
        expect(res.status).toBe(401);
      });

      it('should return empty array if no expenses found', async () => {
        prismaMock.expense.findMany.mockResolvedValue([]);

        const req = new NextRequest('http://localhost:3000/api/expenses');

        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.expenses).toEqual([]);
      });
    });

    // ----- NORMAL CASES -----
    describe('Normal Cases', () => {
      it('should return list of expenses for the store', async () => {
        const mockExpenses = [
          { id: 'e1', amount: 100000, category: 'RENT', storeId: 'store-123' },
          { id: 'e2', amount: 50000, category: 'UTILITIES', storeId: 'store-123' }
        ];
        prismaMock.expense.findMany.mockResolvedValue(mockExpenses as any);

        const req = new NextRequest('http://localhost:3000/api/expenses');

        const res = await GET(req);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.expenses.length).toBe(2);
        expect(prismaMock.expense.findMany).toHaveBeenCalledWith(expect.objectContaining({
          where: expect.objectContaining({
            storeId: 'store-123'
          })
        }));
      });

      it('should filter by date range when provided', async () => {
        prismaMock.expense.findMany.mockResolvedValue([]);

        const req = new NextRequest('http://localhost:3000/api/expenses?startDate=2026-01-01&endDate=2026-01-31');

        await GET(req);

        expect(prismaMock.expense.findMany).toHaveBeenCalledWith(expect.objectContaining({
          where: expect.objectContaining({
            date: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date)
            })
          })
        }));
      });

      it('should filter by category when provided', async () => {
        prismaMock.expense.findMany.mockResolvedValue([]);

        const req = new NextRequest('http://localhost:3000/api/expenses?category=RENT');

        await GET(req);

        expect(prismaMock.expense.findMany).toHaveBeenCalledWith(expect.objectContaining({
          where: expect.objectContaining({
            category: 'RENT'
          })
        }));
      });
    });
  });
});
