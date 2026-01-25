import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { TransactionService } from "@/services/transaction.service";

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        let storeId = session.user.storeId;
        if (!storeId) {
            storeId = request.cookies.get("selectedStoreId")?.value || null;
        }

        if (!storeId) {
            return NextResponse.json({ error: "Store ID required" }, { status: 400 });
        }

        const debtTransactions = await TransactionService.getDebtReport(storeId);

        // Group by Customer for cleaner frontend view? 
        // Or just return flat list? Flat list is more flexible for table, can group in FE or return grouped.
        // Let's return flat list for now but with customer included. 
        // Ideally we also want a summary: Total Debt per Customer.
        
        // Let's do some aggregation here to make FE life easier
        const customerDebts: Record<string, { customer: any, totalDebt: number, transactions: any[] }> = {};

        debtTransactions.forEach(t => {
            const tx = t as any; // Cast to access fields if types are stale
            const custId = tx.customerId || 'UNKNOWN';
            if (!customerDebts[custId]) {
                customerDebts[custId] = {
                    customer: tx.customer,
                    totalDebt: 0,
                    transactions: []
                };
            }
            customerDebts[custId].totalDebt += tx.remainingAmount || 0;
            customerDebts[custId].transactions.push(tx);
        });

        const report = Object.values(customerDebts).sort((a, b) => b.totalDebt - a.totalDebt);

        return NextResponse.json({ 
            data: report,
            totalOutstanding: report.reduce((sum, item) => sum + item.totalDebt, 0)
        });

    } catch (error) {
        console.error("Error fetching debt report:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
