import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const storeId = searchParams.get("storeId") || session.user?.storeId;

    if (!storeId) {
      return NextResponse.json({ error: "Store ID required" }, { status: 400 });
    }

    // Default to today if no date range provided
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Helper to parse YYYY-MM-DD as local date
    const parseLocalDate = (dateStr: string | null, defaultDate: Date) => {
      if (!dateStr) return defaultDate;
      if (dateStr.includes("T")) return new Date(dateStr);
      const [y, m, d] = dateStr.split("-").map(Number);
      return new Date(y, m - 1, d); // Local midnight
    };

    const startDate = parseLocalDate(startDateParam, today);
    const endDate = parseLocalDate(endDateParam, tomorrow);

    // Ensure endDate includes the full day if it's just a date string
    if (endDateParam && !endDateParam.includes("T")) {
      endDate.setHours(23, 59, 59, 999);
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        storeId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    let totalRevenue = 0;
    let totalCost = 0;
    let totalCashReceived = 0;
    let totalDiscount = 0;

    const reportData = transactions.map((tx) => {
      let txCost = 0;

      tx.items.forEach((item) => {
        // HPP Priority: cost_price (stores min_selling_price for new TX) -> purchase_price (legacy) -> estimate
        /* @ts-ignore */
        const unitCost = item.cost_price ?? item.product?.purchase_price ?? item.price * 0.7;
        txCost += unitCost * item.quantity;
      });

      const txProfit = tx.total - txCost;

      // Calculate Cash Received (Handle Legacy vs New Logic)
      let cashIn = 0;
      if (tx.amountPaid > 0) {
        cashIn = tx.amountPaid;
      } else if (tx.paymentStatus === "PAID") {
        // Legacy or fully paid without amountPaid set
        cashIn = tx.total;
      } else {
        // UNPAID/PARTIAL with 0 amountPaid
        cashIn = 0;
      }

      totalRevenue += tx.total;
      totalCost += txCost;
      totalCashReceived += cashIn;
      totalDiscount += (tx.discount || 0);

      return {
        id: tx.id,
        invoiceNumber: tx.invoiceNumber,
        date: tx.createdAt,
        customerName: tx.customer?.name || "Guest",
        paymentMethod: tx.paymentMethod,
        itemCount: tx.items.reduce((sum, item) => sum + item.quantity, 0),
        total: tx.total,
        discount: tx.discount || 0,
        cost: txCost,
        profit: txProfit,
        marginPercent: tx.total > 0 ? (txProfit / tx.total) * 100 : 0,
      };
    });

    const totalProfit = totalRevenue - totalCost;
    const grossMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    
    // Calculate unpaid amount, excluding written-off transactions
    const totalUnpaid = transactions
      .filter(tx => tx.paymentStatus !== 'WRITTEN_OFF')
      .reduce((sum, tx) => sum + (tx.total - tx.amountPaid), 0);

    return NextResponse.json({
      summary: {
        totalTransactions: transactions.length,
        totalRevenue,
        totalDiscount,
        totalCost,
        totalProfit,
        grossMargin,
        totalCashReceived,
        totalUnpaid,
      },
      transactions: reportData,
    });
  } catch (error) {
    console.error("Error fetching sales report:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
