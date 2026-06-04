import prisma from "@/lib/prisma";
import { classifyCapitalTransaction, stripCapitalCategoryPrefix } from "@/lib/capital-classification";
import type { Prisma } from "@prisma/client";
import type { CashFlowSummary, EquitySummary, FinancialSummary, ProfitLossSummary } from "@/services/finance.types";

type TransactionWithItems = Prisma.TransactionGetPayload<{
  include: { items: true };
}>;

type ExpenseRecord = Prisma.ExpenseGetPayload<Record<string, never>>;
type StockAdjustmentRecord = Prisma.StockAdjustmentGetPayload<Record<string, never>>;
type CapitalTransactionRecord = Prisma.CapitalTransactionGetPayload<Record<string, never>>;

export class FinanceService {
  /**
   * Backward-compatible report shape used by the legacy endpoint response.
   * New callers should prefer buildProfitLossSummary + getFinancialPositionSummary.
   */
  static async calculateFinancialSummary(storeId: string, startDate: Date, endDate: Date): Promise<FinancialSummary> {
    if (!storeId) {
      return this.emptyResult();
    }

    const [profitLoss, position] = await Promise.all([
      this.buildProfitLossSummary(storeId, startDate, endDate),
      this.getFinancialPositionSummary(storeId),
    ]);

    return this.composeFinancialSummary(profitLoss, position.cashFlow, position.equity);
  }

  /**
   * Period-scoped profit and loss. This is the only part that should refetch
   * when the selected report date range changes.
   */
  static async buildProfitLossSummary(storeId: string, startDate: Date, endDate: Date): Promise<ProfitLossSummary> {
    if (!storeId) {
      return this.emptyProfitLossResult();
    }

    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    const [transactions, expenses, adjustments] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          storeId,
          status: "COMPLETED",
          createdAt: {
            gte: startDate,
            lte: endOfDay,
          },
        },
        include: {
          items: true,
        },
      }),

      prisma.expense.findMany({
        where: {
          storeId,
          date: {
            gte: startDate,
            lte: endOfDay,
          },
        },
      }),

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

    return this.calculateProfitLossFromRecords(transactions, expenses, adjustments);
  }

  /**
   * All-time cash and equity position. This is intentionally independent from
   * selected report period so it can be fetched/cached separately.
   */
  static async getFinancialPositionSummary(storeId: string): Promise<{ cashFlow: CashFlowSummary; equity: EquitySummary }> {
    if (!storeId) {
      return {
        cashFlow: this.emptyCashFlowResult(),
        equity: this.emptyEquityResult(),
      };
    }

    const [
      allCapitalTransactions,
      allCashTransactions,
      allDebtPayments,
      allPurchaseOrders,
      allCashExpenses,
      profitAggregates,
    ] = await Promise.all([
      prisma.capitalTransaction.findMany({
        where: { storeId },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      }),
      prisma.transaction.aggregate({
        where: { storeId, status: "COMPLETED" },
        _sum: { total: true, amountPaid: true },
      }),
      prisma.debtPayment.aggregate({
        where: { transaction: { storeId, status: "COMPLETED" } },
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
      this.calculateProfitAggregates(storeId),
    ]);

    const totalCapitalInjections = this.sumCapital(allCapitalTransactions, "INJECTION");
    const ownerWithdrawals = this.sumCapital(allCapitalTransactions, "WITHDRAWAL");
    const initialCapital = allCapitalTransactions
      .filter((transaction) => transaction.type === "INJECTION" && this.isInitialCapital(transaction.type, transaction.notes))
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const additionalCapital = Math.max(totalCapitalInjections - initialCapital, 0);

    const salesCashIn = allCashTransactions._sum.amountPaid || 0;
    const debtPaymentCashIn = allDebtPayments._sum.amount || 0;
    const purchaseOrderCashOut = allPurchaseOrders._sum.amountPaid || 0;
    const expenseCashOut = allCashExpenses._sum.amount || 0;
    const totalCashIn = salesCashIn + debtPaymentCashIn + totalCapitalInjections;
    const totalCashOut = purchaseOrderCashOut + expenseCashOut + ownerWithdrawals;
    const currentCashBalance = totalCashIn - totalCashOut;
    const retainedEarnings = profitAggregates.netProfit;
    const endingEquityEstimate = initialCapital + additionalCapital + retainedEarnings - ownerWithdrawals;

    const capitalTransactionDetail = allCapitalTransactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      category: classifyCapitalTransaction(transaction.type as "INJECTION" | "WITHDRAWAL", transaction.notes),
      amount: transaction.amount,
      notes: stripCapitalCategoryPrefix(transaction.notes),
      date: transaction.date.toISOString(),
    }));

    return {
      cashFlow: {
        salesCashIn,
        debtPaymentCashIn,
        initialCapitalCashIn: initialCapital,
        additionalCapitalCashIn: additionalCapital,
        capitalInjection: totalCapitalInjections,
        purchaseOrderCashOut,
        expenseCashOut,
        capitalWithdrawal: ownerWithdrawals,
        totalCashIn,
        totalCashOut,
        netCashFlow: currentCashBalance,
        currentCashBalance,
      },
      equity: {
        initialCapital,
        additionalCapital,
        totalCapitalInjections,
        ownerWithdrawals,
        retainedEarnings,
        endingEquityEstimate,
        capitalTransactionDetail,
      },
    };
  }

  static composeFinancialSummary(profitLoss: ProfitLossSummary, cashFlow: CashFlowSummary, equity: EquitySummary): FinancialSummary {
    return {
      ...profitLoss,
      currentCashBalance: cashFlow.currentCashBalance,
      cashFlow,
      equity: {
        ...equity,
        periodNetProfit: profitLoss.netProfit,
      },
      capitalTransactionDetail: equity.capitalTransactionDetail,
    };
  }

  private static calculateProfitLossFromRecords(
    transactions: TransactionWithItems[],
    expenses: ExpenseRecord[],
    adjustments: StockAdjustmentRecord[],
  ): ProfitLossSummary {
    let totalRevenue = 0;
    let totalCOGS = 0;

    for (const tx of transactions) {
      totalRevenue += tx.total;

      for (const item of tx.items) {
        const unitCost = item.cost_price ?? item.price * 0.7;
        totalCOGS += unitCost * item.quantity;
      }
    }

    const grossProfit = totalRevenue - totalCOGS;

    let totalExpenses = 0;
    const expensesByCategory: Record<string, number> = {};
    const expensesByCategoryDetail: ProfitLossSummary["expensesByCategoryDetail"] = [];

    for (const expense of expenses) {
      totalExpenses += expense.amount;
      expensesByCategory[expense.category] = (expensesByCategory[expense.category] || 0) + expense.amount;
      expensesByCategoryDetail.push({
        id: expense.id,
        category: expense.category,
        amount: expense.amount,
        description: expense.description,
        date: expense.date.toISOString(),
      });
    }

    let totalWaste = 0;
    let totalCorrections = 0;
    const wasteDetail: ProfitLossSummary["wasteDetail"] = [];
    const correctionDetail: ProfitLossSummary["correctionDetail"] = [];

    for (const adjustment of adjustments) {
      if (adjustment.type === "SYSTEM_ERROR") {
        continue;
      }

      // totalValue is always positive, separate by type
      // CORRECTION = positive adjustment (gain), WASTE/DAMAGED/EXPIRED = negative adjustment (loss)
      if (adjustment.type === "CORRECTION") {
        totalCorrections += adjustment.totalValue;
        correctionDetail.push({
          id: adjustment.id,
          type: adjustment.type,
          quantity: adjustment.quantity,
          totalValue: adjustment.totalValue,
          reason: adjustment.reason,
          productName: "",
          date: adjustment.createdAt.toISOString(),
        });
      } else {
        totalWaste += Math.abs(adjustment.totalValue);
        wasteDetail.push({
          id: adjustment.id,
          type: adjustment.type,
          quantity: adjustment.quantity,
          totalValue: Math.abs(adjustment.totalValue),
          reason: adjustment.reason,
          productName: "",
          date: adjustment.createdAt.toISOString(),
        });
      }
    }

    let totalWriteOffs = 0;
    const writeOffDetail: ProfitLossSummary["writeOffDetail"] = [];
    for (const tx of transactions) {
      if (tx.paymentStatus === "WRITTEN_OFF" && tx.writtenOffAmount) {
        totalWriteOffs += tx.writtenOffAmount;
        writeOffDetail.push({
          id: tx.id,
          invoiceNumber: tx.invoiceNumber,
          writtenOffAmount: tx.writtenOffAmount,
          reason: tx.writtenOffReason,
          writtenOffAt: tx.writtenOffAt?.toISOString() || tx.createdAt.toISOString(),
        });
      }
    }

    const netProfit = grossProfit - totalExpenses - totalWaste + totalCorrections - totalWriteOffs;

    return {
      totalRevenue,
      totalCOGS,
      grossProfit,
      totalExpenses,
      totalWaste,
      totalCorrections,
      totalWriteOffs,
      netProfit,
      expensesByCategory,
      expensesByCategoryDetail,
      wasteDetail,
      correctionDetail,
      writeOffDetail,
      grossMarginPercent: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
      netMarginPercent: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
    };
  }

  private static emptyResult(): FinancialSummary {
    return this.composeFinancialSummary(this.emptyProfitLossResult(), this.emptyCashFlowResult(), this.emptyEquityResult());
  }

  private static emptyProfitLossResult(): ProfitLossSummary {
    return {
      totalRevenue: 0,
      totalCOGS: 0,
      grossProfit: 0,
      totalExpenses: 0,
      totalWaste: 0,
      totalCorrections: 0,
      totalWriteOffs: 0,
      netProfit: 0,
      expensesByCategory: {},
      expensesByCategoryDetail: [],
      wasteDetail: [],
      correctionDetail: [],
      writeOffDetail: [],
      grossMarginPercent: 0,
      netMarginPercent: 0,
    };
  }

  private static emptyCashFlowResult(): CashFlowSummary {
    return {
      salesCashIn: 0,
      debtPaymentCashIn: 0,
      initialCapitalCashIn: 0,
      additionalCapitalCashIn: 0,
      capitalInjection: 0,
      purchaseOrderCashOut: 0,
      expenseCashOut: 0,
      capitalWithdrawal: 0,
      totalCashIn: 0,
      totalCashOut: 0,
      netCashFlow: 0,
      currentCashBalance: 0,
    };
  }

  private static emptyEquityResult(): EquitySummary {
    return {
      initialCapital: 0,
      additionalCapital: 0,
      totalCapitalInjections: 0,
      ownerWithdrawals: 0,
      retainedEarnings: 0,
      endingEquityEstimate: 0,
      capitalTransactionDetail: [],
    };
  }

  private static sumCapital(transactions: CapitalTransactionRecord[], type: "INJECTION" | "WITHDRAWAL"): number {
    return transactions.filter((transaction) => transaction.type === type).reduce((sum, transaction) => sum + transaction.amount, 0);
  }

  private static isInitialCapital(type: string, notes: string | null): boolean {
    return classifyCapitalTransaction(type as "INJECTION" | "WITHDRAWAL", notes) === "INITIAL_CAPITAL";
  }

  private static calculateNetProfitFromRecords(
    transactions: TransactionWithItems[],
    expenses: ExpenseRecord[],
    adjustments: StockAdjustmentRecord[],
  ): number {
    return this.calculateProfitLossFromRecords(transactions, expenses, adjustments).netProfit;
  }

  private static async calculateProfitAggregates(storeId: string): Promise<{ netProfit: number }> {
    const [
      transactionAggregates,
      expenseAggregates,
      adjustmentAggregates,
    ] = await Promise.all([
      prisma.transaction.aggregate({
        where: { storeId, status: "COMPLETED" },
        _sum: { total: true, writtenOffAmount: true },
      }),
      prisma.expense.aggregate({
        where: { storeId },
        _sum: { amount: true },
      }),
      this.calculateAdjustmentAggregates(storeId),
    ]);

    const totalRevenue = transactionAggregates._sum.total || 0;
    const totalWriteOffs = transactionAggregates._sum.writtenOffAmount || 0;
    const totalExpenses = expenseAggregates._sum.amount || 0;
    const totalWaste = adjustmentAggregates.totalWaste;
    const totalCorrections = adjustmentAggregates.totalCorrections;

    const grossProfit = totalRevenue;
    const netProfit = grossProfit - totalExpenses - totalWaste + totalCorrections - totalWriteOffs;

    return { netProfit };
  }

  private static async calculateAdjustmentAggregates(storeId: string): Promise<{
    totalWaste: number;
    totalCorrections: number;
  }> {
    const adjustments = await prisma.stockAdjustment.groupBy({
      by: ["type"],
      where: {
        storeId,
        type: {
          in: ["WASTE", "DAMAGED", "EXPIRED", "CORRECTION", "SYSTEM_ERROR"],
        },
      },
      _sum: {
        totalValue: true,
      },
    });

    let totalWaste = 0;
    let totalCorrections = 0;

    for (const adjustment of adjustments) {
      const value = adjustment._sum.totalValue || 0;
      if (adjustment.type === "CORRECTION") {
        totalCorrections += value;
      } else if (adjustment.type !== "SYSTEM_ERROR") {
        totalWaste += Math.abs(value);
      }
    }

    return { totalWaste, totalCorrections };
  }
}
