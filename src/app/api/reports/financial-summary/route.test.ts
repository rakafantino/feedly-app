
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
    buildProfitLossSummary: jest.fn(),
    getFinancialPositionSummary: jest.fn(),
    composeFinancialSummary: jest.fn(),
  }
}));

import { GET } from './route';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { FinanceService } from '@/services/finance.service';

const authMock = auth as jest.Mock;
const buildProfitLossMock = FinanceService.buildProfitLossSummary as jest.Mock;
const getPositionMock = FinanceService.getFinancialPositionSummary as jest.Mock;
const composeSummaryMock = FinanceService.composeFinancialSummary as jest.Mock;

describe('GET /api/reports/financial-summary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authMock.mockResolvedValue(mockSession);
  });

  const mockProfitLoss = {
    totalRevenue: 1000000,
    totalCOGS: 600000,
    grossProfit: 400000,
    totalExpenses: 100000,
    totalWaste: 50000,
    totalCorrections: 0,
    totalWriteOffs: 0,
    netProfit: 250000,
    expensesByCategory: { 'RENT': 50000, 'UTILITIES': 50000 },
    expensesByCategoryDetail: [],
    wasteDetail: [],
    correctionDetail: [],
    writeOffDetail: [],
    grossMarginPercent: 40,
    netMarginPercent: 25
  };
  const mockPosition = {
    cashFlow: {
      salesCashIn: 1000000,
      debtPaymentCashIn: 0,
      initialCapitalCashIn: 500000,
      additionalCapitalCashIn: 0,
      capitalInjection: 500000,
      purchaseOrderCashOut: 250000,
      expenseCashOut: 100000,
      capitalWithdrawal: 0,
      totalCashIn: 1500000,
      totalCashOut: 350000,
      netCashFlow: 1150000,
      currentCashBalance: 1150000,
    },
    equity: {
      initialCapital: 500000,
      additionalCapital: 0,
      totalCapitalInjections: 500000,
      ownerWithdrawals: 0,
      retainedEarnings: 250000,
      endingEquityEstimate: 750000,
      capitalTransactionDetail: [],
    },
  };
  const mockSummary = {
    ...mockProfitLoss,
    currentCashBalance: 1150000,
    cashFlow: mockPosition.cashFlow,
    equity: {
      ...mockPosition.equity,
      periodNetProfit: 250000,
    },
    capitalTransactionDetail: [],
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
      buildProfitLossMock.mockRejectedValue(new Error('Service Error'));

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
      buildProfitLossMock.mockResolvedValue(mockProfitLoss);
      getPositionMock.mockResolvedValue(mockPosition);
      composeSummaryMock.mockReturnValue(mockSummary);

      const req = new NextRequest('http://localhost:3000/api/reports/financial-summary');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.summary).toBeDefined();
      expect(data.summary.netProfit).toBe(250000);
      expect(buildProfitLossMock).toHaveBeenCalledWith(
        'store-123',
        expect.any(Date),
        expect.any(Date)
      );
      expect(getPositionMock).toHaveBeenCalledWith('store-123');
      expect(composeSummaryMock).toHaveBeenCalledWith(mockProfitLoss, mockPosition.cashFlow, mockPosition.equity);
    });

    it('should accept custom date range', async () => {
      buildProfitLossMock.mockResolvedValue(mockProfitLoss);
      getPositionMock.mockResolvedValue(mockPosition);
      composeSummaryMock.mockReturnValue(mockSummary);

      const req = new NextRequest('http://localhost:3000/api/reports/financial-summary?startDate=2026-01-01&endDate=2026-01-31');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(buildProfitLossMock).toHaveBeenCalledWith(
        'store-123',
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );
    });

    it('should include all financial metrics in response', async () => {
      buildProfitLossMock.mockResolvedValue(mockProfitLoss);
      getPositionMock.mockResolvedValue(mockPosition);
      composeSummaryMock.mockReturnValue(mockSummary);

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
      expect(data.profitLoss).toEqual(mockProfitLoss);
      expect(data.cashFlow).toEqual(mockPosition.cashFlow);
      expect(data.equity).toEqual(mockPosition.equity);
    });

    it('should return only profit-loss scope without fetching all-time position', async () => {
      buildProfitLossMock.mockResolvedValue(mockProfitLoss);

      const req = new NextRequest('http://localhost:3000/api/reports/financial-summary?scope=profit-loss&startDate=2026-01-01&endDate=2026-01-31');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.profitLoss).toEqual(mockProfitLoss);
      expect(data.cashFlow).toBeUndefined();
      expect(getPositionMock).not.toHaveBeenCalled();
      expect(composeSummaryMock).not.toHaveBeenCalled();
    });

    it('should return only financial position scope without parsing date-bound profit loss', async () => {
      getPositionMock.mockResolvedValue(mockPosition);

      const req = new NextRequest('http://localhost:3000/api/reports/financial-summary?scope=position');
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual(mockPosition);
      expect(buildProfitLossMock).not.toHaveBeenCalled();
      expect(composeSummaryMock).not.toHaveBeenCalled();
    });
  });
});
