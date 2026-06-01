import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { calculateDateRange } from "@/lib/dateUtils";

type Timeframe = "day" | "week" | "month";

type DashboardTransaction = Prisma.TransactionGetPayload<{
  select: {
    createdAt: true;
    total: true;
    items: {
      select: {
        quantity: true;
        price: true;
        cost_price: true;
        product: {
          select: {
            category: true;
            purchase_price: true;
          };
        };
      };
    };
  };
}>;

type NumericLike = number | string | bigint | Prisma.Decimal | null;

type TopByQuantityRow = {
  id: string;
  name: string;
  unit: string | null;
  category: string | null;
  quantity: NumericLike;
  revenue: NumericLike;
};

type TopByRevenueRow = TopByQuantityRow & {
  profit: NumericLike;
};

const toNumber = (value: NumericLike): number => Number(value ?? 0);

export const GET = withAuth(
  async (req: NextRequest, session: any, storeId: string | null) => {
    try {
      if (!storeId) {
        return NextResponse.json({ error: "Store ID tidak ditemukan" }, { status: 400 });
      }

      const url = new URL(req.url);
      const timeframe = url.searchParams.get("timeframe") || "week";

      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const yesterdayStart = new Date(today);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      const { startDate, endDate } = calculateDateRange(timeframe as Timeframe);

      const yesterdayEnd = new Date(today);
      yesterdayEnd.setHours(23, 59, 59, 999);

      const { todayStats, yesterdayStats } = await getTodayVsYesterdayStats(storeId, today, tomorrow, yesterdayStart, yesterdayEnd);

      const todayTotal = todayStats.totalAmount;
      const yesterdayTotal = yesterdayStats.totalAmount;
      const totalItemsSold = todayStats.totalItemsSold;
      const transactionCount = todayStats.transactionCount;

      let percentageChange = 0;
      if (yesterdayTotal > 0) {
        percentageChange = ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100;
      }

      const periodTransactions = await prisma.transaction.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          storeId: storeId,
          status: "COMPLETED",
        },
        select: {
          createdAt: true,
          total: true,
          items: {
            select: {
              quantity: true,
              price: true,
              cost_price: true,
              product: {
                select: {
                  category: true,
                  purchase_price: true,
                },
              },
            },
          },
        },
      });

      let currentPeriodTotal = 0;
      let currentPeriodItemsSold = 0;
      const currentPeriodTransactionCount = periodTransactions.length;

      for (const tx of periodTransactions) {
        currentPeriodTotal += tx.total;
        for (const item of tx.items) {
          currentPeriodItemsSold += item.quantity;
        }
      }

      const salesData = generateTimePeriodSalesData(periodTransactions, timeframe as Timeframe, startDate);
      const categorySales = calculateCategorySales(periodTransactions);
      const hourlyTransactions = calculateHourlyTransactions(periodTransactions, timeframe as Timeframe);

      // === OPTIMASI: PARALLEL EXECUTION untuk operasi independen ===
      const [topProducts, { averageMargin, yesterdayMargin }, currentPeriodMargin, inventoryStats, salesTargetResult, expiringProducts] = await Promise.all([
        getTopProducts(storeId, startDate, endDate),
        calculateProfitMarginsFromDB(storeId, today, tomorrow, yesterdayStart, yesterdayEnd),
        calculateMarginFromTransactions(periodTransactions),
        calculateInventoryValue(storeId),
        calculateSalesTargetWithStats(timeframe as Timeframe, storeId, currentPeriodTotal),
        findExpiringProducts(storeId),
      ]);

      return NextResponse.json({
        success: true,
        storeId,
        todayTotal,
        percentageChange,
        totalItemsSold,
        transactionCount,
        salesData,
        categorySales,
        hourlyTransactions,
        topProducts,
        averageMargin,
        yesterdayMargin,
        inventoryStats,
        salesTarget: salesTargetResult.target,
        expiringProducts,
        currentPeriodTotal,
        currentPeriodItemsSold,
        currentPeriodTransactionCount,
        currentPeriodMargin,
      });
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
    }
  },
  { requireStore: true },
);

async function getTodayVsYesterdayStats(storeId: string, today: Date, todayEnd: Date, yesterdayStart: Date, yesterdayEnd: Date) {
  const [todayStats, yesterdayStats] = await Promise.all([getSummaryStatsFromDB(storeId, today, todayEnd), getSummaryStatsFromDB(storeId, yesterdayStart, yesterdayEnd)]);

  return { todayStats, yesterdayStats };
}

async function getSummaryStatsFromDB(storeId: string, startDate: Date, endDate: Date) {
  const [stats, transactions] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        storeId,
        createdAt: { gte: startDate, lt: endDate },
        status: "COMPLETED",
      },
      _sum: { total: true },
      _count: true,
    }),
    prisma.transaction.findMany({
      where: { storeId, createdAt: { gte: startDate, lt: endDate }, status: "COMPLETED" },
      select: { total: true, items: { select: { quantity: true, cost_price: true, product: { select: { purchase_price: true } } } } },
    }),
  ]);

  const itemsSold = transactions.reduce((sum, tx) => sum + tx.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);

  return {
    totalAmount: stats._sum.total || 0,
    transactionCount: stats._count || 0,
    totalItemsSold: itemsSold,
    transactions: transactions as DashboardTransaction[],
  };
}

async function calculateProfitMarginsFromDB(storeId: string, today: Date, todayEnd: Date, yesterdayStart: Date, yesterdayEnd: Date) {
  try {
    const [todayStats, yesterdayStats] = await Promise.all([getSummaryStatsFromDB(storeId, today, todayEnd), getSummaryStatsFromDB(storeId, yesterdayStart, yesterdayEnd)]);

    const averageMargin = calculateMarginFromTransactions(todayStats.transactions);
    const yesterdayMargin = calculateMarginFromTransactions(yesterdayStats.transactions);

    return { averageMargin, yesterdayMargin };
  } catch (error) {
    console.error("Error calculating profit margins:", error);
    return { averageMargin: 0, yesterdayMargin: 0 };
  }
}

async function calculateSalesTargetWithStats(timeframe: Timeframe, storeId: string, currentPeriodTotal: number) {
  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { dailyTarget: true, weeklyTarget: true, monthlyTarget: true },
    });

    let manualTarget = 0;
    if (store) {
      if (timeframe === "day") manualTarget = store.dailyTarget || 0;
      else if (timeframe === "week") manualTarget = store.weeklyTarget || 0;
      else if (timeframe === "month") manualTarget = store.monthlyTarget || 0;
    }

    if (manualTarget > 0) {
      const percentage = (currentPeriodTotal / manualTarget) * 100;
      return {
        target: manualTarget,
        current: currentPeriodTotal,
        percentage: parseFloat(percentage.toFixed(2)),
        timeframe,
        isManual: true,
      };
    }

    const { startDate } = calculateDateRange(timeframe);
    let historicalStartDate: Date;
    let multiplier = 1;

    if (timeframe === "day") {
      historicalStartDate = new Date(startDate);
      historicalStartDate.setDate(historicalStartDate.getDate() - 30);
      multiplier = 1.1;
    } else if (timeframe === "week") {
      historicalStartDate = new Date(startDate);
      historicalStartDate.setDate(historicalStartDate.getDate() - 84);
      multiplier = 1.15;
    } else {
      historicalStartDate = new Date(startDate);
      historicalStartDate.setMonth(historicalStartDate.getMonth() - 6);
      multiplier = 1.2;
    }

    const historicalStats = await getSummaryStatsFromDB(storeId, historicalStartDate, startDate);
    const historicalTotalAmount = historicalStats.totalAmount;

    let periodCount = 0;
    if (timeframe === "day") {
      periodCount = Math.ceil((startDate.getTime() - historicalStartDate.getTime()) / (1000 * 60 * 60 * 24));
    } else if (timeframe === "week") {
      periodCount = Math.ceil((startDate.getTime() - historicalStartDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
    } else {
      periodCount = (startDate.getFullYear() - historicalStartDate.getFullYear()) * 12 + startDate.getMonth() - historicalStartDate.getMonth();
    }

    const averagePerPeriod = periodCount > 0 ? historicalTotalAmount / periodCount : 0;
    const target = Math.ceil(averagePerPeriod * multiplier);
    const percentage = target > 0 ? (currentPeriodTotal / target) * 100 : 0;

    return {
      target,
      current: currentPeriodTotal,
      percentage: parseFloat(percentage.toFixed(2)),
      timeframe,
      isManual: false,
    };
  } catch (error) {
    console.error("Error calculating sales target:", error);
    return {
      target: 0,
      current: currentPeriodTotal,
      percentage: 0,
      timeframe,
      isManual: false,
    };
  }
}

function generateTimePeriodSalesData(transactions: DashboardTransaction[], timeframe: Timeframe, startDate: Date) {
  const result: Array<{ name: string; sales: number }> = [];

  if (timeframe === "day") {
    const hours = 24;
    for (let i = 0; i < hours; i++) {
      const hourDate = new Date(startDate);
      hourDate.setHours(startDate.getHours() + i);

      const hourTransactions = transactions.filter((tx) => {
        return tx.createdAt.getHours() === hourDate.getHours() && tx.createdAt.getDate() === hourDate.getDate() && tx.createdAt.getMonth() === hourDate.getMonth();
      });

      const hourSales = hourTransactions.reduce((sum, tx) => sum + tx.total, 0);

      result.push({
        name: `${hourDate.getHours()}:00`,
        sales: hourSales,
      });
    }
  } else if (timeframe === "week") {
    const days = 7;
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

    for (let i = 0; i < days; i++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(dayDate.getDate() + i);

      const dayStart = new Date(dayDate);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayDate);
      dayEnd.setHours(23, 59, 59, 999);

      const dayTransactions = transactions.filter((tx) => {
        return tx.createdAt >= dayStart && tx.createdAt <= dayEnd;
      });

      const daySales = dayTransactions.reduce((sum, tx) => sum + tx.total, 0);

      result.push({
        name: dayNames[dayDate.getDay()],
        sales: daySales,
      });
    }
  } else if (timeframe === "month") {
    const weeks = 4;

    for (let i = 0; i < weeks; i++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(startDate.getDate() + i * 7);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const weekTransactions = transactions.filter((tx) => {
        return tx.createdAt >= weekStart && tx.createdAt <= weekEnd;
      });

      const weekSales = weekTransactions.reduce((sum, tx) => sum + tx.total, 0);

      result.push({
        name: `Minggu ${i + 1}`,
        sales: weekSales,
      });
    }
  }

  return result;
}

function calculateCategorySales(transactions: DashboardTransaction[]) {
  const categoryMap: Record<string, number> = {};

  transactions.forEach((tx) => {
    tx.items.forEach((item) => {
      const category = item.product.category || "Tidak Terkategori";
      if (!categoryMap[category]) {
        categoryMap[category] = 0;
      }
      categoryMap[category] += item.price * item.quantity;
    });
  });

  return Object.entries(categoryMap).map(([name, value]) => ({
    name,
    value,
  }));
}

function calculateHourlyTransactions(transactions: DashboardTransaction[], timeframe: Timeframe = "day") {
  if (timeframe === "day") {
    const hourlyData: Array<{ hour: string; transactions: number }> = [];

    for (let hour = 0; hour <= 23; hour++) {
      const hourString = `${hour.toString().padStart(2, "0")}:00`;

      const hourTransactions = transactions.filter((tx) => {
        return tx.createdAt.getHours() === hour;
      });

      hourlyData.push({
        hour: hourString,
        transactions: hourTransactions.length,
      });
    }

    return hourlyData;
  } else if (timeframe === "week") {
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const dailyData: Array<{ hour: string; transactions: number }> = [];

    for (let day = 0; day < 7; day++) {
      const dayTransactions = transactions.filter((tx) => {
        return tx.createdAt.getDay() === day;
      });

      dailyData.push({
        hour: dayNames[day],
        transactions: dayTransactions.length,
      });
    }

    return dailyData;
  } else if (timeframe === "month") {
    const weeklyData: Array<{ hour: string; transactions: number }> = [];

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    for (let week = 0; week < 4; week++) {
      const weekStart = new Date(startOfMonth);
      weekStart.setDate(startOfMonth.getDate() + week * 7);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const weekTransactions = transactions.filter((tx) => {
        return tx.createdAt >= weekStart && tx.createdAt <= weekEnd;
      });

      weeklyData.push({
        hour: `Minggu ${week + 1}`,
        transactions: weekTransactions.length,
      });
    }

    return weeklyData;
  }

  return [];
}

async function getTopProducts(storeId: string, startDate: Date, endDate: Date) {
  const topByQuantity = (await prisma.$queryRaw`
    SELECT 
      p.id, p.name, p.unit, p.category,
      SUM(ti.quantity) as quantity,
      SUM(ti.quantity * ti.price) as revenue
    FROM "transaction_items" ti
    JOIN "transactions" t ON ti.transaction_id = t.id
    JOIN "products" p ON ti.product_id = p.id
    WHERE t.store_id = ${storeId}
      AND t.created_at >= ${startDate}
      AND t.created_at <= ${endDate}
      AND t.status = 'COMPLETED'
    GROUP BY p.id, p.name, p.unit, p.category
    ORDER BY quantity DESC
    LIMIT 5
  `) as TopByQuantityRow[];

  const topByRevenue = (await prisma.$queryRaw`
    SELECT 
      p.id, p.name, p.unit, p.category,
      SUM(ti.quantity) as quantity,
      SUM(ti.quantity * ti.price) as revenue,
      SUM(ti.quantity * (ti.price - COALESCE(ti.cost_price, p.purchase_price, (ti.price * 0.7)))) as profit
    FROM "transaction_items" ti
    JOIN "transactions" t ON ti.transaction_id = t.id
    JOIN "products" p ON ti.product_id = p.id
    WHERE t.store_id = ${storeId}
      AND t.created_at >= ${startDate}
      AND t.created_at <= ${endDate}
      AND t.status = 'COMPLETED'
    GROUP BY p.id, p.name, p.unit, p.category
    ORDER BY profit DESC
    LIMIT 5
  `) as TopByRevenueRow[];

  return {
    byQuantity: topByQuantity.map((item) => ({
      ...item,
      quantity: toNumber(item.quantity),
      revenue: toNumber(item.revenue),
    })),
    byRevenue: topByRevenue.map((item) => ({
      ...item,
      quantity: toNumber(item.quantity),
      revenue: toNumber(item.revenue),
      profit: toNumber(item.profit),
    })),
  };
}

const calculateMarginFromTransactions = (transactions: DashboardTransaction[]) => {
  if (!transactions || transactions.length === 0) return 0;

  let totalRevenue = 0;
  let totalCost = 0;

  for (const tx of transactions) {
    totalRevenue += tx.total;

    for (const item of tx.items) {
      const costPrice = item.cost_price ?? item.product?.purchase_price ?? item.price * 0.7;
      totalCost += costPrice * item.quantity;
    }
  }

  if (totalRevenue === 0) return 0;
  return ((totalRevenue - totalCost) / totalRevenue) * 100;
};

async function calculateInventoryValue(storeId: string) {
  try {
    const products = await prisma.product.findMany({
      where: {
        storeId: storeId,
        isDeleted: false,
      },
      select: {
        category: true,
        purchase_price: true,
        stock: true,
      },
    });

    const totalValue = products.reduce((total, product) => {
      return total + (product.purchase_price || 0) * product.stock;
    }, 0);

    const productsInStock = products.reduce((total, product) => total + product.stock, 0);

    const categories = [...new Set(products.map((p) => p.category))];
    const categoryValues = categories.map((category) => {
      const categoryProducts = products.filter((p) => p.category === category);
      const value = categoryProducts.reduce((sum, p) => sum + (p.purchase_price || 0) * p.stock, 0);

      return {
        category,
        value,
        itemCount: categoryProducts.length,
        stockCount: categoryProducts.reduce((sum, p) => sum + p.stock, 0),
      };
    });

    return {
      totalValue,
      productsInStock,
      categoryValues,
    };
  } catch (error) {
    console.error("Error calculating inventory value:", error);
    return {
      totalValue: 0,
      productsInStock: 0,
      categoryValues: [],
    };
  }
}

async function findExpiringProducts(storeId: string) {
  try {
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { expiryNotificationDays: true },
    });

    const notificationDays = store?.expiryNotificationDays || 30;
    const today = new Date();
    const notificationDate = new Date(today);
    notificationDate.setDate(today.getDate() + notificationDays);

    const expiringBatches = await prisma.productBatch.findMany({
      where: {
        expiryDate: {
          not: null,
          lte: notificationDate,
          gte: today,
        },
        stock: {
          gt: 0,
        },
        product: {
          storeId: storeId,
          isDeleted: false,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            category: true,
            unit: true,
          },
        },
      },
      orderBy: {
        expiryDate: "asc",
      },
    });

    return expiringBatches.map((batch) => ({
      id: batch.product.id,
      name: batch.product.name,
      category: batch.product.category,
      expiryDate: batch.expiryDate,
      daysUntilExpiry: batch.expiryDate ? Math.ceil((new Date(batch.expiryDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null,
      stock: batch.stock,
      unit: batch.product.unit,
      batchNumber: batch.batchNumber,
    }));
  } catch (error) {
    console.error("Error finding expiring products:", error);
    return [];
  }
}
