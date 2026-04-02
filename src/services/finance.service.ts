import prisma from "@/lib/prisma";

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
  expensesByCategoryDetail?: Array<{ id: string; category: string; amount: number; description: string | null; date: string }>;
  wasteDetail?: Array<{ id: string; type: string; quantity: number; totalValue: number; reason: string | null; productName: string; date: string }>;
  correctionDetail?: Array<{ id: string; type: string; quantity: number; totalValue: number; reason: string | null; productName: string; date: string }>;
  writeOffDetail?: Array<{ id: string; invoiceNumber: string | null; writtenOffAmount: number; reason: string | null; writtenOffAt: string }>;
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
  static async calculateFinancialSummary(storeId: string, startDate: Date, endDate: Date): Promise<FinancialSummary> {
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
            lte: endOfDay,
          },
        },
        include: {
          items: true,
        },
      }),

      // 2. Expenses
      prisma.expense.findMany({
        where: {
          storeId,
          date: {
            gte: startDate,
            lte: endOfDay,
          },
        },
      }),

      // 3. Stock adjustments (waste, damaged, expired, correction)
      prisma.stockAdjustment.findMany({
        where: {
          storeId,
          createdAt: {
            gte: startDate,
            lte: endOfDay,
          },
          type: {
            in: ["WASTE", "DAMAGED", "EXPIRED", "CORRECTION", "SYSTEM_ERROR"],
          },
        },
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
        const unitCost = (item as any).cost_price ?? item.price * 0.7;
        totalCOGS += unitCost * item.quantity;
      }
    }

    const grossProfit = totalRevenue - totalCOGS;

    // Calculate total expenses and breakdown by category
    let totalExpenses = 0;
    const expensesByCategory: Record<string, number> = {};
    const expensesByCategoryDetail: Array<{ id: string; category: string; amount: number; description: string | null; date: string }> = [];

    for (const expense of expenses) {
      const cat = expense.category;

      // Include RENT in P&L (it's no longer amortized automatically)
      totalExpenses += expense.amount;
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + expense.amount;
      expensesByCategoryDetail.push({
        id: expense.id,
        category: cat,
        amount: expense.amount,
        description: expense.description,
        date: expense.date.toISOString(),
      });
    }

    // Calculate total waste and corrections separately
    let totalWaste = 0;
    let totalCorrections = 0;
    const wasteDetail: Array<{ id: string; type: string; quantity: number; totalValue: number; reason: string | null; productName: string; date: string }> = [];
    const correctionDetail: Array<{ id: string; type: string; quantity: number; totalValue: number; reason: string | null; productName: string; date: string }> = [];
    for (const adj of adjustments) {
      if (adj.type === "SYSTEM_ERROR") {
        // Abaikan SYSTEM_ERROR dari perhitungan Laba Rugi
        continue;
      }

      if (adj.type === "CORRECTION" && adj.totalValue > 0) {
        // Positive CORRECTION = stok masuk (bukan kerugian)
        totalCorrections += adj.totalValue;
        correctionDetail.push({
          id: adj.id,
          type: adj.type,
          quantity: adj.quantity,
          totalValue: adj.totalValue,
          reason: adj.reason,
          productName: "", // Will be populated with product name
          date: adj.createdAt.toISOString(),
        });
      } else {
        // WASTE, DAMAGED, EXPIRED, or negative CORRECTION = kerugian
        totalWaste += Math.abs(adj.totalValue);
        wasteDetail.push({
          id: adj.id,
          type: adj.type,
          quantity: adj.quantity,
          totalValue: adj.totalValue,
          reason: adj.reason,
          productName: "", // Will be populated with product name
          date: adj.createdAt.toISOString(),
        });
      }
    }

    // Calculate total write-offs (Piutang Tak Tertagih)
    // Sum of writtenOffAmount from transactions written off in this period
    let totalWriteOffs = 0;
    const writeOffDetail: Array<{ id: string; invoiceNumber: string | null; writtenOffAmount: number; reason: string | null; writtenOffAt: string }> = [];
    for (const tx of transactions) {
      const txAny = tx as any; // Cast for new fields
      if (txAny.paymentStatus === "WRITTEN_OFF" && txAny.writtenOffAmount) {
        totalWriteOffs += txAny.writtenOffAmount;
        writeOffDetail.push({
          id: tx.id,
          invoiceNumber: txAny.invoiceNumber,
          writtenOffAmount: txAny.writtenOffAmount,
          reason: txAny.writtenOffReason,
          writtenOffAt: txAny.writtenOffAt?.toISOString() || tx.createdAt.toISOString(),
        });
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
        _sum: { amountPaid: true },
      }),
      prisma.debtPayment.aggregate({
        where: { transaction: { storeId } },
        _sum: { amount: true },
      }),
      prisma.purchaseOrder.aggregate({
        where: { storeId },
        _sum: { amountPaid: true },
      }),
      prisma.expense.aggregate({
        where: { storeId },
        _sum: { amount: true },
      }),
      prisma.capitalTransaction.aggregate({
        where: { storeId, type: "INJECTION" },
        _sum: { amount: true },
      }),
      prisma.capitalTransaction.aggregate({
        where: { storeId, type: "WITHDRAWAL" },
        _sum: { amount: true },
      }),
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
      expensesByCategoryDetail,
      wasteDetail,
      correctionDetail,
      writeOffDetail,
      grossMarginPercent,
      netMarginPercent,
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
      expensesByCategoryDetail: [],
      wasteDetail: [],
      correctionDetail: [],
      writeOffDetail: [],
      grossMarginPercent: 0,
      netMarginPercent: 0,
    };
  }
}
