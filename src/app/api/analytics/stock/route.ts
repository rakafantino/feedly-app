import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { calculateDateRange } from "@/lib/dateUtils";
import { addDays } from "date-fns";

interface TransactionItem {
  quantity: number;
  price: number;
  product: { price: number } | null;
}

interface TransactionWithItems {
  createdAt: Date;
  items: TransactionItem[];
}

interface ExpiringCandidate {
  id: string;
  expiry_date: Date | null;
  batches: { expiryDate: Date | null }[];
}

export const GET = withAuth(async (req: NextRequest, session, storeId) => {
  try {
    const url = new URL(req.url);
    const timeframe = url.searchParams.get("timeframe") || "week";
    const { startDate, endDate } = calculateDateRange(timeframe as "day" | "week" | "month");

    // 1. Get Expiry Settings and Calculate Threshold Date
    const storeSettings = await prisma.store.findUnique({
      where: { id: storeId! },
      select: { expiryNotificationDays: true },
    });
    const expiryNotificationDays = storeSettings?.expiryNotificationDays || 30;
    const thresholdDate = addDays(new Date(), expiryNotificationDays);

    // Parallel Data Fetching - Optimized
    const [pendingOrdersCount, lowStockCount, expiringCandidates, categoryStatsRaw, transactions] = await Promise.all([
      // 2. Pending Orders Count (Ordered or Partially Received)
      prisma.purchaseOrder.count({
        where: {
          storeId: storeId!,
          status: { in: ["ordered", "partially_received"] },
        },
      }),

      // 3. Low Stock Count
      prisma.product.count({
        where: {
          storeId: storeId!,
          isDeleted: false,
          stock: { lte: prisma.product.fields.threshold },
        },
      }),

      // 4. Expiring Products Count (Smart Logic)
      prisma.product.findMany({
        where: {
          storeId: storeId!,
          isDeleted: false,
          stock: { gt: 0 },
          OR: [
            { expiry_date: { lte: thresholdDate } },
            {
              batches: {
                some: {
                  expiryDate: { lte: thresholdDate },
                  stock: { gt: 0 },
                },
              },
            },
          ],
        },
        select: {
          id: true,
          expiry_date: true,
          batches: {
            where: { stock: { gt: 0 } },
            select: { expiryDate: true },
          },
        },
      }),

      // 5. Category Stats (Using Raw Query for Performance)
      prisma.$queryRaw<{ category: string; count: bigint; value: number }[]>`
        SELECT 
          COALESCE(category, 'Tidak Terkategori') as category,
          COUNT(*)::int as count,
          SUM(stock * price)::float as value
        FROM products 
        WHERE store_id = ${storeId!}::text AND is_deleted = false
        GROUP BY category
      `,

      // 6. Transactions for History
      prisma.transaction.findMany({
        where: {
          storeId: storeId!,
          createdAt: { gte: startDate, lte: endDate },
        },
        include: {
          items: {
            include: { product: { select: { price: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Calculate accurate expiring count in memory
    let expiringCount = 0;
    if (Array.isArray(expiringCandidates)) {
      expiringCount = (expiringCandidates as ExpiringCandidate[]).filter((p) => {
        const hasBatches = p.batches && p.batches.length > 0;

        if (hasBatches) {
          return p.batches.some((b) => b.expiryDate && new Date(b.expiryDate) <= thresholdDate);
        } else {
          return p.expiry_date && new Date(p.expiry_date) <= thresholdDate;
        }
      }).length;
    }

    // Format Category Stats
    const categoryStats = Array.isArray(categoryStatsRaw)
      ? categoryStatsRaw.map((item) => ({
          name: item.category,
          count: Number(item.count),
          value: item.value || 0,
        }))
      : [];

    const historicalData = generateHistoricalData(transactions as TransactionWithItems[], timeframe as "day" | "week" | "month", startDate);

    return NextResponse.json({
      success: true,
      storeId,
      timeframe,
      lowStockCount,
      history: historicalData,
      categoryStats,
      pendingOrdersCount,
      expiringCount,
    });
  } catch (error) {
    console.error("Error fetching analytics data:", error);
    return NextResponse.json({ error: "Failed to fetch analytics data" }, { status: 500 });
  }
}, { requireStore: true });

// Fungsi untuk menghasilkan data historis dari transaksi
function generateHistoricalData(transactions: TransactionWithItems[], timeframe: "day" | "week" | "month", startDate: Date) {
  const result: Array<{ date: string; count: number; value: number }> = [];

  if (timeframe === "day") {
    const hours = 24;
    for (let i = 0; i < hours; i++) {
      const hourDate = new Date(startDate);
      hourDate.setHours(startDate.getHours() + i);

      const hourTransactions = transactions.filter((tx) => {
        const txDate = new Date(tx.createdAt);
        return txDate.getHours() === hourDate.getHours() && txDate.getDate() === hourDate.getDate() && txDate.getMonth() === hourDate.getMonth();
      });

      let totalCount = 0;
      let totalValue = 0;

      hourTransactions.forEach((tx) => {
        tx.items.forEach((item) => {
          totalCount += item.quantity || 0;
          totalValue += item.price * item.quantity;
        });
      });

      result.push({
        date: `${hourDate.getHours()}:00`,
        count: totalCount,
        value: totalValue,
      });
    }
  } else if (timeframe === "week") {
    const days = 7;
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

    for (let i = 0; i < days; i++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(startDate.getDate() + i);

      const dayTransactions = transactions.filter((tx) => {
        const txDate = new Date(tx.createdAt);
        return txDate.getDate() === dayDate.getDate() && txDate.getMonth() === dayDate.getMonth();
      });

      let totalCount = 0;
      let totalValue = 0;

      dayTransactions.forEach((tx) => {
        tx.items.forEach((item) => {
          totalCount += item.quantity || 0;
          totalValue += item.price * item.quantity;
        });
      });

      result.push({
        date: dayNames[dayDate.getDay()],
        count: totalCount,
        value: totalValue,
      });
    }
  } else if (timeframe === "month") {
    const weeks = 4;

    for (let i = 0; i < weeks; i++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(startDate.getDate() + i * 7);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const weekTransactions = transactions.filter((tx) => {
        const txDate = new Date(tx.createdAt);
        return txDate >= weekStart && txDate <= weekEnd;
      });

      let totalCount = 0;
      let totalValue = 0;

      weekTransactions.forEach((tx) => {
        tx.items.forEach((item) => {
          totalCount += item.quantity || 0;
          totalValue += item.price * item.quantity;
        });
      });

      result.push({
        date: `Minggu ${i + 1}`,
        count: totalCount,
        value: totalValue,
      });
    }
  }

  return result;
}
