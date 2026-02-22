import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { TransactionService } from "@/services/transaction.service";

export const GET = withAuth(async (request: NextRequest, session, storeId) => {
    try {
        const debtTransactions = await TransactionService.getDebtReport(storeId!);

        // Aggregate by customer
        const customerDebts: Record<string, { customer: unknown, totalDebt: number, transactions: unknown[] }> = {};

        debtTransactions.forEach(t => {
            const tx = t as Record<string, unknown>;
            const custId = (tx.customerId as string) || 'UNKNOWN';
            if (!customerDebts[custId]) {
                customerDebts[custId] = {
                    customer: tx.customer,
                    totalDebt: 0,
                    transactions: []
                };
            }
            customerDebts[custId].totalDebt += (tx.remainingAmount as number) || 0;
            customerDebts[custId].transactions.push(tx);
        });

        const report = Object.values(customerDebts).sort((a, b) => {
            const debtDiff = b.totalDebt - a.totalDebt;
            if (debtDiff !== 0) return debtDiff;

            const nameA = (a.customer as Record<string, string>)?.name || '';
            const nameB = (b.customer as Record<string, string>)?.name || '';
            return nameA.localeCompare(nameB);
        });

        return NextResponse.json({ 
            data: report,
            totalOutstanding: report.reduce((sum, item) => sum + item.totalDebt, 0)
        });

    } catch (error) {
        console.error("Error fetching debt report:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}, { requireStore: true });
