
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

import { PUT, DELETE } from './route';
import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/lib/auth';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;
const authMock = auth as jest.Mock;

describe('/api/expenses/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockResolvedValue(mockSession as any);
  });

  const mockExpense = {
    id: 'expense-123',
    storeId: 'store-123',
    amount: 500000,
    category: 'RENT',
    description: 'Monthly rent',
    date: new Date('2026-01-15'),
    createdById: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const context = { params: Promise.resolve({ id: 'expense-123' }) };

  // =============================
  // PUT /api/expenses/[id] (Update)
  // =============================
  describe('PUT /api/expenses/[id]', () => {
    const validUpdateData = {
      amount: 600000,
      category: 'UTILITIES',
      description: 'Updated description'
    };

    // ----- EDGE CASES -----
    describe('Edge Cases', () => {
      it('should return 401 if user is unauthenticated', async () => {
        authMock.mockResolvedValueOnce(null);

        const req = new NextRequest('http://localhost:3000/api/expenses/expense-123', {
          method: 'PUT',
          body: JSON.stringify(validUpdateData)
        });

        const res = await PUT(req, context);
        expect(res.status).toBe(401);
      });

      it('should return 404 if expense not found', async () => {
        prismaMock.expense.findFirst.mockResolvedValue(null);

        const req = new NextRequest('http://localhost:3000/api/expenses/expense-123', {
          method: 'PUT',
          body: JSON.stringify(validUpdateData)
        });

        const res = await PUT(req, context);
        expect(res.status).toBe(404);
      });

      it('should return 403 if expense belongs to different store', async () => {
        prismaMock.expense.findFirst.mockResolvedValue({
          ...mockExpense,
          storeId: 'different-store'
        } as any);

        const req = new NextRequest('http://localhost:3000/api/expenses/expense-123', {
          method: 'PUT',
          body: JSON.stringify(validUpdateData)
        });

        const res = await PUT(req, context);
        expect(res.status).toBe(403);
      });

      it('should return 400 if amount is negative', async () => {
        prismaMock.expense.findFirst.mockResolvedValue(mockExpense as any);

        const req = new NextRequest('http://localhost:3000/api/expenses/expense-123', {
          method: 'PUT',
          body: JSON.stringify({ ...validUpdateData, amount: -1000 })
        });

        const res = await PUT(req, context);
        expect(res.status).toBe(400);
      });

      it('should return 500 on database error', async () => {
        prismaMock.expense.findFirst.mockResolvedValue(mockExpense as any);
        prismaMock.expense.update.mockRejectedValue(new Error('DB Error'));

        const req = new NextRequest('http://localhost:3000/api/expenses/expense-123', {
          method: 'PUT',
          body: JSON.stringify(validUpdateData)
        });

        const res = await PUT(req, context);
        expect(res.status).toBe(500);
      });
    });

    // ----- NORMAL CASES -----
    describe('Normal Cases', () => {
      it('should update an expense successfully', async () => {
        prismaMock.expense.findFirst.mockResolvedValue(mockExpense as any);
        prismaMock.expense.update.mockResolvedValue({
          ...mockExpense,
          ...validUpdateData
        } as any);

        const req = new NextRequest('http://localhost:3000/api/expenses/expense-123', {
          method: 'PUT',
          body: JSON.stringify(validUpdateData)
        });

        const res = await PUT(req, context);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.expense.amount).toBe(600000);
        expect(prismaMock.expense.update).toHaveBeenCalledWith(expect.objectContaining({
          where: { id: 'expense-123' },
          data: expect.objectContaining({
            amount: 600000,
            category: 'UTILITIES'
          })
        }));
      });

      it('should allow partial update (only description)', async () => {
        prismaMock.expense.findFirst.mockResolvedValue(mockExpense as any);
        prismaMock.expense.update.mockResolvedValue({
          ...mockExpense,
          description: 'New description only'
        } as any);

        const req = new NextRequest('http://localhost:3000/api/expenses/expense-123', {
          method: 'PUT',
          body: JSON.stringify({ description: 'New description only' })
        });

        const res = await PUT(req, context);
        expect(res.status).toBe(200);
      });
    });
  });

  // =============================
  // DELETE /api/expenses/[id]
  // =============================
  describe('DELETE /api/expenses/[id]', () => {
    // ----- EDGE CASES -----
    describe('Edge Cases', () => {
      it('should return 401 if user is unauthenticated', async () => {
        authMock.mockResolvedValueOnce(null);

        const req = new NextRequest('http://localhost:3000/api/expenses/expense-123', {
          method: 'DELETE'
        });

        const res = await DELETE(req, context);
        expect(res.status).toBe(401);
      });

      it('should return 404 if expense not found', async () => {
        prismaMock.expense.findFirst.mockResolvedValue(null);

        const req = new NextRequest('http://localhost:3000/api/expenses/expense-123', {
          method: 'DELETE'
        });

        const res = await DELETE(req, context);
        expect(res.status).toBe(404);
      });

      it('should return 403 if expense belongs to different store', async () => {
        prismaMock.expense.findFirst.mockResolvedValue({
          ...mockExpense,
          storeId: 'different-store'
        } as any);

        const req = new NextRequest('http://localhost:3000/api/expenses/expense-123', {
          method: 'DELETE'
        });

        const res = await DELETE(req, context);
        expect(res.status).toBe(403);
      });

      it('should return 500 on database error', async () => {
        prismaMock.expense.findFirst.mockResolvedValue(mockExpense as any);
        prismaMock.expense.delete.mockRejectedValue(new Error('DB Error'));

        const req = new NextRequest('http://localhost:3000/api/expenses/expense-123', {
          method: 'DELETE'
        });

        const res = await DELETE(req, context);
        expect(res.status).toBe(500);
      });
    });

    // ----- NORMAL CASES -----
    describe('Normal Cases', () => {
      it('should delete an expense successfully', async () => {
        prismaMock.expense.findFirst.mockResolvedValue(mockExpense as any);
        prismaMock.expense.delete.mockResolvedValue(mockExpense as any);

        const req = new NextRequest('http://localhost:3000/api/expenses/expense-123', {
          method: 'DELETE'
        });

        const res = await DELETE(req, context);
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(prismaMock.expense.delete).toHaveBeenCalledWith({
          where: { id: 'expense-123' }
        });
      });
    });
  });
});
