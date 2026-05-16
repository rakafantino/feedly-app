
// 1. Mock Prisma
jest.mock('@/lib/prisma', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { mockDeep } = require('jest-mock-extended');
  return {
    __esModule: true,
    default: mockDeep(),
  };
});

import { FinanceService } from './finance.service';
import prisma from '@/lib/prisma';
import { DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('FinanceService', () => {
  const mockStoreId = 'store-123';
  const startDate = new Date('2026-01-01');
  const endDate = new Date('2026-01-31');

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock aggregate functions for cash balance
    prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amountPaid: 0 } } as any);
    prismaMock.debtPayment.aggregate.mockResolvedValue({ _sum: { amount: 0 } } as any);
    prismaMock.purchaseOrder.aggregate.mockResolvedValue({ _sum: { amountPaid: 0 } } as any);
    prismaMock.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } } as any);
    prismaMock.capitalTransaction.aggregate.mockResolvedValue({ _sum: { amount: 0 } } as any);
    prismaMock.capitalTransaction.findMany.mockResolvedValue([] as any);
  });

  describe('calculateFinancialSummary', () => {
    // =============================
    // EDGE CASES
    // =============================
    describe('Edge Cases', () => {
      it('should return zeros when no transactions exist (except amortization)', async () => {
        prismaMock.transaction.findMany.mockResolvedValue([]);
        prismaMock.expense.findMany.mockResolvedValue([]);
        prismaMock.stockAdjustment.findMany.mockResolvedValue([]);

        const result = await FinanceService.calculateFinancialSummary(mockStoreId, startDate, endDate);

        expect(result.totalRevenue).toBe(0);
        expect(result.totalCOGS).toBe(0);
        expect(result.grossProfit).toBe(0);
        expect(result.totalExpenses).toBe(0); // 1 month amortization removed
        expect(result.totalWaste).toBe(0);
        expect(result.netProfit).toBe(0); // 0 - 0
      });

      it('should return zeros when storeId is empty', async () => {
        prismaMock.transaction.findMany.mockResolvedValue([]);
        prismaMock.expense.findMany.mockResolvedValue([]);
        prismaMock.stockAdjustment.findMany.mockResolvedValue([]);

        const result = await FinanceService.calculateFinancialSummary('', startDate, endDate);

        expect(result.netProfit).toBe(0);
      });

      it('should handle transactions with no items gracefully', async () => {
        prismaMock.transaction.findMany.mockResolvedValue([
          {
            id: 'tx-1',
            total: 100000,
            items: [],
            storeId: mockStoreId,
          }
        ] as any);
        prismaMock.expense.findMany.mockResolvedValue([]);
        prismaMock.stockAdjustment.findMany.mockResolvedValue([]);

        const result = await FinanceService.calculateFinancialSummary(mockStoreId, startDate, endDate);

        expect(result.totalRevenue).toBe(100000);
        expect(result.totalCOGS).toBe(0);
        expect(result.grossProfit).toBe(100000);
      });

      it('should handle negative net profit correctly (expenses > gross profit)', async () => {
        prismaMock.transaction.findMany.mockResolvedValue([
          {
            id: 'tx-1',
            total: 100000,
            items: [{ price: 100000, quantity: 1, cost_price: 60000 }],
            storeId: mockStoreId,
          }
        ] as any);
        // Expenses more than gross profit
        prismaMock.expense.findMany.mockResolvedValue([
          { id: 'exp-1', amount: 50000, category: 'OTHER', date: new Date('2026-01-15') },
          { id: 'exp-2', amount: 10000, category: 'OTHER', date: new Date('2026-01-15') }
        ] as any);
        prismaMock.stockAdjustment.findMany.mockResolvedValue([]);

        const result = await FinanceService.calculateFinancialSummary(mockStoreId, startDate, endDate);

        // Gross Profit = 100000 - 60000 = 40000
        // Expenses = 60000
        // Net Profit = 40000 - 60000 = -20000
        expect(result.grossProfit).toBe(40000);
        expect(result.totalExpenses).toBe(60000);
        expect(result.netProfit).toBe(-20000);
      });
    });

    // =============================
    // NORMAL CASES
    // =============================
    describe('Normal Cases', () => {
      it('should calculate gross profit correctly from transactions', async () => {
        prismaMock.transaction.findMany.mockResolvedValue([
          {
            id: 'tx-1',
            total: 150000,
            items: [
              { price: 100000, quantity: 1, cost_price: 60000 },
              { price: 50000, quantity: 1, cost_price: 30000 }
            ],
            storeId: mockStoreId,
          }
        ] as any);
        prismaMock.expense.findMany.mockResolvedValue([]);
        prismaMock.stockAdjustment.findMany.mockResolvedValue([]);

        const result = await FinanceService.calculateFinancialSummary(mockStoreId, startDate, endDate);

        expect(result.totalRevenue).toBe(150000);
        expect(result.totalCOGS).toBe(90000); // 60000 + 30000
        expect(result.grossProfit).toBe(60000); // 150000 - 90000
      });

      it('should sum all expenses correctly', async () => {
        prismaMock.transaction.findMany.mockResolvedValue([]);
        prismaMock.expense.findMany.mockResolvedValue([
          { id: 'exp-1', amount: 500000, category: 'RENT', date: new Date('2026-01-15') }, // Included
          { id: 'exp-2', amount: 200000, category: 'SALARY', date: new Date('2026-01-15') },
          { id: 'exp-3', amount: 100000, category: 'UTILITIES', date: new Date('2026-01-15') } 
        ] as any);
        prismaMock.stockAdjustment.findMany.mockResolvedValue([]);

        const result = await FinanceService.calculateFinancialSummary(mockStoreId, startDate, endDate);

        // 500000 + 200000 + 100000 = 800000
        expect(result.totalExpenses).toBe(800000);
      });

      it('should sum all waste (stock adjustments) correctly', async () => {
        prismaMock.transaction.findMany.mockResolvedValue([]);
        prismaMock.expense.findMany.mockResolvedValue([]);
        prismaMock.stockAdjustment.findMany.mockResolvedValue([
          { id: 'adj-1', type: 'WASTE', totalValue: -50000, createdAt: new Date('2026-01-15') },
          { id: 'adj-2', type: 'EXPIRED', totalValue: -30000, createdAt: new Date('2026-01-15') },
          { id: 'adj-3', type: 'DAMAGED', totalValue: -20000, createdAt: new Date('2026-01-15') }
        ] as any);

        const result = await FinanceService.calculateFinancialSummary(mockStoreId, startDate, endDate);

        // Waste totalValue is negative, we want absolute value as loss
        expect(result.totalWaste).toBe(100000);
      });

      it('should calculate net profit correctly: GrossProfit - Expenses - Waste', async () => {
        prismaMock.transaction.findMany.mockResolvedValue([
          {
            id: 'tx-1',
            total: 500000,
            items: [
              { price: 500000, quantity: 1, cost_price: 300000 }
            ],
            storeId: mockStoreId,
          }
        ] as any);
        prismaMock.expense.findMany.mockResolvedValue([
          { id: 'exp-1', amount: 50000, category: 'OTHER', date: new Date('2026-01-15') }
        ] as any);
        prismaMock.stockAdjustment.findMany.mockResolvedValue([
          { id: 'adj-1', type: 'WASTE', totalValue: -20000, createdAt: new Date('2026-01-15') }
        ] as any);

        const result = await FinanceService.calculateFinancialSummary(mockStoreId, startDate, endDate);

        // Revenue = 500000
        // COGS = 300000
        // Gross Profit = 200000
        // Expenses = 50000
        // Waste = 20000
        // Net Profit = 200000 - 50000 - 20000 = 130000
        expect(result.totalRevenue).toBe(500000);
        expect(result.totalCOGS).toBe(300000);
        expect(result.grossProfit).toBe(200000);
        expect(result.totalExpenses).toBe(50000);
        expect(result.totalWaste).toBe(20000);
        expect(result.netProfit).toBe(130000);
      });

      it('should filter transactions by date range', async () => {
        prismaMock.transaction.findMany.mockResolvedValue([]);
        prismaMock.expense.findMany.mockResolvedValue([]);
        prismaMock.stockAdjustment.findMany.mockResolvedValue([]);

        await FinanceService.calculateFinancialSummary(mockStoreId, startDate, endDate);

        expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
          where: expect.objectContaining({
            storeId: mockStoreId,
            createdAt: expect.objectContaining({
              gte: startDate,
              lte: expect.any(Date)
            })
          })
        }));
      });

      it('should include expense breakdown by category', async () => {
        prismaMock.transaction.findMany.mockResolvedValue([]);
        prismaMock.expense.findMany.mockResolvedValue([
          { id: 'exp-1', amount: 500000, category: 'RENT', date: new Date('2026-01-15') }, // Excluded
          { id: 'exp-2', amount: 200000, category: 'SALARY', date: new Date('2026-01-15') },
          { id: 'exp-3', amount: 100000, category: 'RENT', date: new Date('2026-01-15') } // Excluded
        ] as any);
        prismaMock.stockAdjustment.findMany.mockResolvedValue([]);

        const result = await FinanceService.calculateFinancialSummary(mockStoreId, startDate, endDate);

        expect(result.expensesByCategory).toBeDefined();
        expect(result.expensesByCategory?.['RENT']).toBe(600000);
        expect(result.expensesByCategory?.['AMORTIZATION_RENT']).toBeUndefined();
        expect(result.expensesByCategory?.['SALARY']).toBe(200000);
      });

      it('should expose cash flow and equity sections without mixing capital into profit', async () => {
        prismaMock.transaction.findMany.mockResolvedValue([
          {
            id: 'tx-1',
            total: 500000,
            amountPaid: 500000,
            items: [{ price: 500000, quantity: 1, cost_price: 300000 }],
            storeId: mockStoreId,
          }
        ] as any);
        prismaMock.expense.findMany.mockResolvedValue([
          { id: 'exp-1', amount: 50000, category: 'OTHER', date: new Date('2026-01-15') }
        ] as any);
        prismaMock.stockAdjustment.findMany.mockResolvedValue([]);
        prismaMock.capitalTransaction.findMany.mockResolvedValue([
          {
            id: 'cap-1',
            type: 'INJECTION',
            amount: 1000000,
            notes: 'Modal Awal',
            date: new Date('2026-01-01'),
            createdAt: new Date('2026-01-01'),
          },
          {
            id: 'cap-2',
            type: 'INJECTION',
            amount: 250000,
            notes: 'Tambahan modal',
            date: new Date('2026-01-10'),
            createdAt: new Date('2026-01-10'),
          },
          {
            id: 'cap-3',
            type: 'WITHDRAWAL',
            amount: 75000,
            notes: 'Prive',
            date: new Date('2026-01-20'),
            createdAt: new Date('2026-01-20'),
          }
        ] as any);
        prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amountPaid: 500000 } } as any);
        prismaMock.debtPayment.aggregate.mockResolvedValue({ _sum: { amount: 0 } } as any);
        prismaMock.purchaseOrder.aggregate.mockResolvedValue({ _sum: { amountPaid: 300000 } } as any);
        prismaMock.expense.aggregate.mockResolvedValue({ _sum: { amount: 50000 } } as any);
        prismaMock.capitalTransaction.aggregate
          .mockResolvedValueOnce({ _sum: { amount: 1250000 } } as any)
          .mockResolvedValueOnce({ _sum: { amount: 75000 } } as any);

        const result = await FinanceService.calculateFinancialSummary(mockStoreId, startDate, endDate);

        expect(result.netProfit).toBe(150000);
        expect(result.cashFlow).toEqual({
          salesCashIn: 500000,
          debtPaymentCashIn: 0,
          initialCapitalCashIn: 1000000,
          additionalCapitalCashIn: 250000,
          capitalInjection: 1250000,
          purchaseOrderCashOut: 300000,
          expenseCashOut: 50000,
          capitalWithdrawal: 75000,
          totalCashIn: 1750000,
          totalCashOut: 425000,
          netCashFlow: 1325000,
        });
        expect(result.equity).toEqual({
          initialCapital: 1000000,
          additionalCapital: 250000,
          totalCapitalInjections: 1250000,
          ownerWithdrawals: 75000,
          periodNetProfit: 150000,
          retainedEarnings: 150000,
          endingEquityEstimate: 1325000,
        });
        expect(result.capitalTransactionDetail).toHaveLength(3);
      });

      it('should keep all-time initial capital visible even when the current period has no initial capital row', async () => {
        prismaMock.transaction.findMany.mockResolvedValue([
          {
            id: 'tx-1',
            total: 100000,
            items: [{ price: 100000, quantity: 1, cost_price: 70000 }],
            storeId: mockStoreId,
          }
        ] as any);
        prismaMock.expense.findMany.mockResolvedValue([]);
        prismaMock.stockAdjustment.findMany.mockResolvedValue([]);
        prismaMock.capitalTransaction.findMany.mockResolvedValue([
          {
            id: 'initial-cap',
            type: 'INJECTION',
            amount: 17737000,
            notes: 'Modal Awal (Barang, Ruko, Kasir, Listrik, Plastik) + Patungan Ayah',
            date: new Date('2025-12-01'),
            createdAt: new Date('2025-12-01'),
          },
          {
            id: 'period-cap-1',
            type: 'INJECTION',
            amount: 50000,
            notes: 'Tambah duit receh',
            date: new Date('2026-01-10'),
            createdAt: new Date('2026-01-10'),
          }
        ] as any);
        prismaMock.transaction.aggregate.mockResolvedValue({ _sum: { amountPaid: 100000 } } as any);
        prismaMock.debtPayment.aggregate.mockResolvedValue({ _sum: { amount: 0 } } as any);
        prismaMock.purchaseOrder.aggregate.mockResolvedValue({ _sum: { amountPaid: 0 } } as any);
        prismaMock.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } } as any);
        prismaMock.capitalTransaction.aggregate
          .mockResolvedValueOnce({ _sum: { amount: 17787000 } } as any)
          .mockResolvedValueOnce({ _sum: { amount: 0 } } as any);

        const result = await FinanceService.calculateFinancialSummary(mockStoreId, startDate, endDate);

        expect(result.equity?.initialCapital).toBe(17737000);
        expect(result.equity?.additionalCapital).toBe(50000);
        expect(result.cashFlow?.initialCapitalCashIn).toBe(17737000);
        expect(result.cashFlow?.additionalCapitalCashIn).toBe(50000);
      });
    });
  });
});
