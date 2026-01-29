import prisma from '@/lib/prisma';

export interface FinancialSummary {
  totalRevenue: number;
  totalCOGS: number; // Cost of Goods Sold
  grossProfit: number;
  totalExpenses: number;
  totalWaste: number;
  totalWriteOffs: number; // Piutang Tak Tertagih
  netProfit: number;
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

    // 1. Fetch transactions with items
    const transactions = await prisma.transaction.findMany({
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
    });

    // 2. Fetch expenses
    const expenses = await prisma.expense.findMany({
      where: {
        storeId,
        date: {
          gte: startDate,
          lte: endOfDay
        }
      }
    });

    // 3. Fetch stock adjustments (waste, damaged, expired)
    const adjustments = await prisma.stockAdjustment.findMany({
      where: {
        storeId,
        createdAt: {
          gte: startDate,
          lte: endOfDay
        },
        type: {
          in: ['WASTE', 'DAMAGED', 'EXPIRED']
        }
      }
    });

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
      totalExpenses += expense.amount;
      
      const cat = expense.category;
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + expense.amount;
    }

    // Calculate total waste (absolute value since totalValue is negative for losses)
    let totalWaste = 0;
    for (const adj of adjustments) {
      totalWaste += Math.abs(adj.totalValue);
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

    // Net Profit = Gross Profit - Expenses - Waste - Write-Offs
    const netProfit = grossProfit - totalExpenses - totalWaste - totalWriteOffs;

    // Calculate margins
    const grossMarginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalCOGS,
      grossProfit,
      totalExpenses,
      totalWaste,
      totalWriteOffs,
      netProfit,
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
      totalWriteOffs: 0,
      netProfit: 0,
      expensesByCategory: {},
      grossMarginPercent: 0,
      netMarginPercent: 0
    };
  }
}
