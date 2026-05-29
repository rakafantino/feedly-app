export interface ProfitLossSummary {
  totalRevenue: number;
  totalCOGS: number;
  grossProfit: number;
  totalExpenses: number;
  totalWaste: number;
  totalCorrections: number;
  totalWriteOffs: number;
  netProfit: number;
  expensesByCategory: Record<string, number>;
  expensesByCategoryDetail: Array<{ id: string; category: string; amount: number; description: string | null; date: string }>;
  wasteDetail: Array<{ id: string; type: string; quantity: number; totalValue: number; reason: string | null; productName: string; date: string }>;
  correctionDetail: Array<{ id: string; type: string; quantity: number; totalValue: number; reason: string | null; productName: string; date: string }>;
  writeOffDetail: Array<{ id: string; invoiceNumber: string | null; writtenOffAmount: number; reason: string | null; writtenOffAt: string }>;
  grossMarginPercent: number;
  netMarginPercent: number;
}

export interface CashFlowSummary {
  salesCashIn: number;
  debtPaymentCashIn: number;
  initialCapitalCashIn: number;
  additionalCapitalCashIn: number;
  capitalInjection: number;
  purchaseOrderCashOut: number;
  expenseCashOut: number;
  capitalWithdrawal: number;
  totalCashIn: number;
  totalCashOut: number;
  netCashFlow: number;
  currentCashBalance: number;
}

export interface EquitySummary {
  initialCapital: number;
  additionalCapital: number;
  totalCapitalInjections: number;
  ownerWithdrawals: number;
  retainedEarnings: number;
  endingEquityEstimate: number;
  capitalTransactionDetail: Array<{ id: string; type: string; category: string; amount: number; notes: string | null; date: string }>;
}

export interface FinancialSummary extends ProfitLossSummary {
  currentCashBalance: number;
  cashFlow: CashFlowSummary;
  equity: EquitySummary & {
    periodNetProfit: number;
  };
  capitalTransactionDetail: EquitySummary["capitalTransactionDetail"];
}

export interface FinancialReportResponse {
  profitLoss: ProfitLossSummary;
  cashFlow: CashFlowSummary;
  equity: EquitySummary;
  summary: FinancialSummary;
  period: {
    startDate: string;
    endDate: string;
  };
}
