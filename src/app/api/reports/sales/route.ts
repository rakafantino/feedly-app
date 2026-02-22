import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

export const GET = withAuth(async (req: NextRequest, session, storeId) => {
  try {
    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    
    // Pagination parameters
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

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

    const whereClause = {
      storeId: storeId!,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Get total count for pagination
    const totalCount = await prisma.transaction.count({ where: whereClause });
    const totalPages = Math.ceil(totalCount / limit);

    // Get ALL transactions for summary calculation (without pagination)
    const allTransactions = await prisma.transaction.findMany({
      where: whereClause,
      include: {
        items: {
          include: {
            product: {
              select: {
                purchase_price: true,
                price: true,
              }
            },
          },
        },
        customer: {
          select: {
            name: true,
          }
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    let totalRevenue = 0;
    let totalCost = 0;
    let totalCashReceived = 0;
    let totalDiscount = 0;

    // Calculate summary from ALL transactions
    const allReportData = allTransactions.map((tx) => {
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
    const totalUnpaid = allTransactions
      .filter(tx => tx.paymentStatus !== 'WRITTEN_OFF')
      .reduce((sum, tx) => sum + (tx.total - tx.amountPaid), 0);

    // Get paginated transactions for display
    const paginatedTransactions = allReportData.slice(skip, skip + limit);

    return NextResponse.json({
      summary: {
        totalTransactions: allTransactions.length,
        totalRevenue,
        totalDiscount,
        totalCost,
        totalProfit,
        grossMargin,
        totalCashReceived,
        totalUnpaid,
      },
      transactions: paginatedTransactions,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching sales report:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}, { requireStore: true });
