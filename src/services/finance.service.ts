import prisma from '@/lib/prisma';

export interface FinancialSummary {
  totalRevenue: number;
  totalCOGS: number; // Cost of Goods Sold
  grossProfit: number;
  totalExpenses: number;
  totalWaste: number;
  totalCorrections: number; // Koreksi Stok Masuk (positive adjustments)
  totalWriteOffs: number; // Piutang Tak Tertagih
  netProfit: number;
  currentCashBalance: number; // Saldo Kas Aktual (All Time)
  expensesByCategory?: Record<string, number>;
  grossMarginPercent?: number;
  netMarginPercent?: number;
}

export class FinanceService {
  /**
   * Calculate financial summary for a store within a date range.
   * 
   * Formula: Net Profit = Gross Profit - Expenses - Waste - Write-Offs
   * Where: Gross Profit = Total Revenue - COGS
   */
  static async calculateFinancialSummary(
    storeId: string,
    startDate: Date,
    endDate: Date
  ): Promise<FinancialSummary> {
    if (!storeId) {
      return this.emptyResult();
    }

    // Ensure end date includes full day
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch all data in parallel (independent queries)
    const [transactions, expenses, adjustments] = await Promise.all([
      // 1. Transactions with items
      prisma.transaction.findMany({
        where: {
          storeId,
          createdAt: {
            gte: startDate,
            lte: endOfDay
          }
        },
        include: {
          items: true
        }
      }),

      // 2. Expenses
      prisma.expense.findMany({
        where: {
          storeId,
          date: {
            gte: startDate,
            lte: endOfDay
          }
        }
      }),

      // 3. Stock adjustments (waste, damaged, expired, correction)
      prisma.stockAdjustment.findMany({
        where: {
          storeId,
          createdAt: {
            gte: startDate,
            lte: endOfDay
          },
          type: {
            in: ['WASTE', 'DAMAGED', 'EXPIRED', 'CORRECTION', 'SYSTEM_ERROR']
          }
        }
      }),
    ]);

    // Calculate Revenue and COGS
    // COGS = cost_price (stores min_selling_price = harga beli + biaya + margin pengaman)
    let totalRevenue = 0;
    let totalCOGS = 0;

    for (const tx of transactions) {
      totalRevenue += tx.total;

      for (const item of tx.items) {
        // HPP Priority: cost_price (historical) -> price * 0.7 (fallback estimate)
        // Note: cost_price now stores min_selling_price for new transactions
        const unitCost = (item as any).cost_price ?? (item.price * 0.7);
        totalCOGS += unitCost * item.quantity;
      }
    }

    const grossProfit = totalRevenue - totalCOGS;

    // Calculate total expenses and breakdown by category
    let totalExpenses = 0;
    const expensesByCategory: Record<string, number> = {};

    for (const expense of expenses) {
      const cat = expense.category;
      
      // Include RENT in P&L (it's no longer amortized automatically)
      totalExpenses += expense.amount;
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + expense.amount;
    }

    // Calculate total waste and corrections separately
    let totalWaste = 0;
    let totalCorrections = 0;
    for (const adj of adjustments) {
      if (adj.type === 'SYSTEM_ERROR') {
        // Abaikan SYSTEM_ERROR dari perhitungan Laba Rugi
        continue;
      }
      
      if (adj.type === 'CORRECTION' && adj.totalValue > 0) {
        // Positive CORRECTION = stok masuk (bukan kerugian)
        totalCorrections += adj.totalValue;
      } else {
        // WASTE, DAMAGED, EXPIRED, or negative CORRECTION = kerugian
        totalWaste += Math.abs(adj.totalValue);
      }
    }

    // Calculate total write-offs (Piutang Tak Tertagih)
    // Sum of writtenOffAmount from transactions written off in this period
    let totalWriteOffs = 0;
    for (const tx of transactions) {
      const txAny = tx as any; // Cast for new fields
      if (txAny.paymentStatus === 'WRITTEN_OFF' && txAny.writtenOffAmount) {
        totalWriteOffs += txAny.writtenOffAmount;
      }
    }

    // Net Profit = Gross Profit - Expenses - Waste + Corrections - Write-Offs
    const netProfit = grossProfit - totalExpenses - totalWaste + totalCorrections - totalWriteOffs;

    // Calculate margins
    const grossMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Calculate All-Time Cash Balance
    const [allTransactions, allDebtPayments, allPurchaseOrders, allExpenses, capitalInjections, capitalWithdrawals] = await Promise.all([
      prisma.transaction.aggregate({
        where: { storeId },
        _sum: { amountPaid: true }
      }),
      prisma.debtPayment.aggregate({
        where: { transaction: { storeId } },
        _sum: { amount: true }
      }),
      prisma.purchaseOrder.aggregate({
        where: { storeId },
        _sum: { amountPaid: true }
      }),
      prisma.expense.aggregate({
        where: { storeId },
        _sum: { amount: true }
      }),
      prisma.capitalTransaction.aggregate({
        where: { storeId, type: 'INJECTION' },
        _sum: { amount: true }
      }),
      prisma.capitalTransaction.aggregate({
        where: { storeId, type: 'WITHDRAWAL' },
        _sum: { amount: true }
      })
    ]);

    const totalCashIn = (allTransactions._sum.amountPaid || 0) + (allDebtPayments._sum.amount || 0) + (capitalInjections._sum.amount || 0);
    const totalCashOut = (allPurchaseOrders._sum.amountPaid || 0) + (allExpenses._sum.amount || 0) + (capitalWithdrawals._sum.amount || 0);
    const currentCashBalance = totalCashIn - totalCashOut;

    return {
      totalRevenue,
      totalCOGS,
      grossProfit,
      totalExpenses,
      totalWaste,
      totalCorrections,
      totalWriteOffs,
      netProfit,
      currentCashBalance,
      expensesByCategory,
      grossMarginPercent,
      netMarginPercent
    };
  }

  private static emptyResult(): FinancialSummary {
    return {
      totalRevenue: 0,
      totalCOGS: 0,
      grossProfit: 0,
      totalExpenses: 0,
      totalWaste: 0,
      totalCorrections: 0,
      totalWriteOffs: 0,
      netProfit: 0,
      currentCashBalance: 0,
      expensesByCategory: {},
      grossMarginPercent: 0,
      netMarginPercent: 0
    };
  }
}
