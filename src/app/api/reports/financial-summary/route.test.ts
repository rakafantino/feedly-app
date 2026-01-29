
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

// 3. Mock FinanceService
jest.mock('@/services/finance.service', () => ({
  FinanceService: {
    calculateFinancialSummary: jest.fn()
  }
}));

import { GET } from './route';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { FinanceService } from '@/services/finance.service';

const authMock = auth as jest.Mock;
const financeServiceMock = FinanceService.calculateFinancialSummary as jest.Mock;

describe('GET /api/reports/financial-summary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockResolvedValue(mockSession);
  });

  const mockSummary = {
    totalRevenue: 1000000,
    totalCOGS: 600000,
    grossProfit: 400000,
    totalExpenses: 100000,
    totalWaste: 50000,
    netProfit: 250000,
    expensesByCategory: { 'RENT': 50000, 'UTILITIES': 50000 },
    grossMarginPercent: 40,
    netMarginPercent: 25
  };

  // =============================
  // EDGE CASES
  // =============================
  describe('Edge Cases', () => {
    it('should return 401 if user is unauthenticated', async () => {
      authMock.mockResolvedValueOnce(null);

      const req = new NextRequest('http://localhost:3000/api/reports/financial-summary');
      const res = await GET(req);

      expect(res.status).toBe(401);
    });

    it('should return 400 if storeId is not available', async () => {
      authMock.mockResolvedValueOnce({
        user: { id: 'user-123', name: 'Test', storeId: null }
      });

      const req = new NextRequest('http://localhost:3000/api/reports/financial-summary');
      const res = await GET(req);

      expect(res.status).toBe(400);
    });

    it('should return 500 on service error', async () => {
      financeServiceMock.mockRejectedValue(new Error('Service Error'));

      const req = new NextRequest('http://localhost:3000/api/reports/financial-summary');
      const res = await GET(req);

      expect(res.status).toBe(500);
    });
  });

  // =============================
  // NORMAL CASES
  // =============================
  describe('Normal Cases', () => {
    it('should return financial summary for current month by default', async () => {
      financeServiceMock.mockResolvedValue(mockSummary);

      const req = new NextRequest('http://localhost:3000/api/reports/financial-summary');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.summary).toBeDefined();
      expect(data.summary.netProfit).toBe(250000);
      expect(financeServiceMock).toHaveBeenCalledWith(
        'store-123',
        expect.any(Date),
        expect.any(Date)
      );
    });

    it('should accept custom date range', async () => {
      financeServiceMock.mockResolvedValue(mockSummary);

      const req = new NextRequest('http://localhost:3000/api/reports/financial-summary?startDate=2026-01-01&endDate=2026-01-31');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(financeServiceMock).toHaveBeenCalledWith(
        'store-123',
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );
    });

    it('should include all financial metrics in response', async () => {
      financeServiceMock.mockResolvedValue(mockSummary);

      const req = new NextRequest('http://localhost:3000/api/reports/financial-summary');
      const res = await GET(req);
      const data = await res.json();

      expect(data.summary.totalRevenue).toBe(1000000);
      expect(data.summary.totalCOGS).toBe(600000);
      expect(data.summary.grossProfit).toBe(400000);
      expect(data.summary.totalExpenses).toBe(100000);
      expect(data.summary.totalWaste).toBe(50000);
      expect(data.summary.netProfit).toBe(250000);
      expect(data.summary.expensesByCategory).toEqual({ 'RENT': 50000, 'UTILITIES': 50000 });
    });
  });
});
