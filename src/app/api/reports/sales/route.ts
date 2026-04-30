import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

export const GET = withAuth(async (req: NextRequest, session, storeId) => {
  try {
    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    
    const parsePositiveInt = (value: string | null, defaultValue: number) => {
      const parsed = Number.parseInt(value ?? "", 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
    };

    // Pagination parameters
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = parsePositiveInt(searchParams.get("limit"), 10);
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

    type AggregateNumeric = number | string | bigint | null;
    type TotalsRow = {
      totalCashReceived: AggregateNumeric;
      totalUnpaid: AggregateNumeric;
    };
    type CostRow = {
      totalCost: AggregateNumeric;
    };
    const toNumber = (value: AggregateNumeric): number => Number(value ?? 0);

    const [totalCount, summaryAggregate, paymentTotals, costTotals, paginatedTransactionsRaw] = await Promise.all([
      prisma.transaction.count({ where: whereClause }),
      prisma.transaction.aggregate({
        where: whereClause,
        _sum: {
          total: true,
          discount: true,
        },
      }),
      prisma.$queryRaw<TotalsRow[]>`
        SELECT
          COALESCE(
            SUM(
              CASE
                WHEN t.amount_paid > 0 THEN t.amount_paid
                WHEN t.payment_status = 'PAID' THEN t.total
                ELSE 0
              END
            ),
            0
          ) AS "totalCashReceived",
          COALESCE(
            SUM(
              CASE
                WHEN t.payment_status <> 'WRITTEN_OFF' THEN (t.total - t.amount_paid)
                ELSE 0
              END
            ),
            0
          ) AS "totalUnpaid"
        FROM "transactions" t
        WHERE t.store_id = ${storeId!}
          AND t.created_at >= ${startDate}
          AND t.created_at <= ${endDate}
      `,
      prisma.$queryRaw<CostRow[]>`
        SELECT
          COALESCE(SUM((COALESCE(ti.cost_price, p.purchase_price, (ti.price * 0.7))) * ti.quantity), 0) AS "totalCost"
        FROM "transaction_items" ti
        INNER JOIN "transactions" t ON t.id = ti.transaction_id
        LEFT JOIN "products" p ON p.id = ti.product_id
        WHERE t.store_id = ${storeId!}
          AND t.created_at >= ${startDate}
          AND t.created_at <= ${endDate}
      `,
      prisma.transaction.findMany({
        where: whereClause,
        select: {
          id: true,
          invoiceNumber: true,
          createdAt: true,
          paymentMethod: true,
          total: true,
          discount: true,
          customer: {
            select: {
              name: true,
            },
          },
          items: {
            select: {
              quantity: true,
              price: true,
              cost_price: true,
              product: {
                select: {
                  purchase_price: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    const totalRevenue = summaryAggregate._sum.total ?? 0;
    const totalDiscount = summaryAggregate._sum.discount ?? 0;
    const totalCost = toNumber(costTotals[0]?.totalCost ?? 0);
    const totalCashReceived = toNumber(paymentTotals[0]?.totalCashReceived ?? 0);
    const totalUnpaid = toNumber(paymentTotals[0]?.totalUnpaid ?? 0);
    const totalProfit = totalRevenue - totalCost;
    const grossMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const paginatedTransactions = paginatedTransactionsRaw.map((tx) => {
      const txCost = tx.items.reduce((sum, item) => {
        const unitCost = item.cost_price ?? item.product?.purchase_price ?? item.price * 0.7;
        return sum + unitCost * item.quantity;
      }, 0);
      const txProfit = tx.total - txCost;

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

    return NextResponse.json({
      summary: {
        totalTransactions: totalCount,
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
