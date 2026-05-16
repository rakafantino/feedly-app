import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

function parsePositiveInt(value: string | null, defaultValue: number, maxValue?: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return maxValue ? Math.min(parsed, maxValue) : parsed;
}

export const GET = withAuth(
  async (request: NextRequest, session, storeId) => {
    try {
      const segments = request.nextUrl.pathname.split("/");
      const productId = segments[segments.length - 2];

      if (!productId) {
        return NextResponse.json({ error: "ID produk tidak valid" }, { status: 400 });
      }

      const product = await prisma.product.findFirst({
        where: { id: productId, isDeleted: false, storeId: storeId! },
        select: { id: true },
      });

      if (!product) {
        return NextResponse.json({ error: "Produk tidak ditemukan" }, { status: 404 });
      }

      const { searchParams } = new URL(request.url);
      const limitParam = searchParams.get("limit");
      const fetchAll = limitParam === "all";
      const page = fetchAll ? 1 : parsePositiveInt(searchParams.get("page"), 1);
      const limit = fetchAll ? 25 : parsePositiveInt(limitParam, 25, 100);
      const skip = (page - 1) * limit;
      const where = {
        productId,
        transaction: {
          storeId: storeId!,
          status: "COMPLETED",
        },
      };

      const [total, items, summaryItems] = await Promise.all([
        prisma.transactionItem.count({ where }),
        prisma.transactionItem.findMany({
          where,
          select: {
            id: true,
            quantity: true,
            price: true,
            cost_price: true,
            transaction: {
              select: {
                id: true,
                invoiceNumber: true,
                createdAt: true,
                paymentMethod: true,
                paymentStatus: true,
                customer: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            product: {
              select: {
                purchase_price: true,
              },
            },
          },
          orderBy: {
            transaction: {
              createdAt: "desc",
            },
          },
          ...(fetchAll ? {} : { skip, take: limit }),
        }),
        prisma.transactionItem.findMany({
          where,
          select: {
            quantity: true,
            price: true,
            cost_price: true,
            transactionId: true,
            product: {
              select: {
                purchase_price: true,
              },
            },
          },
        }),
      ]);

      const history = items.map((item) => {
        const unitCost = item.cost_price ?? item.product?.purchase_price ?? 0;
        const lineTotal = item.quantity * item.price;
        const lineCost = item.quantity * unitCost;

        return {
          id: item.id,
          transactionId: item.transaction.id,
          invoiceNumber: item.transaction.invoiceNumber,
          soldAt: item.transaction.createdAt.toISOString(),
          customerName: item.transaction.customer?.name || "Guest",
          paymentMethod: item.transaction.paymentMethod,
          paymentStatus: item.transaction.paymentStatus,
          quantity: item.quantity,
          unitPrice: item.price,
          unitCost,
          lineTotal,
          lineCost,
          profit: lineTotal - lineCost,
        };
      });

      const summary = summaryItems.reduce(
        (acc, item) => {
          const unitCost = item.cost_price ?? item.product?.purchase_price ?? 0;
          const lineTotal = item.quantity * item.price;
          const lineCost = item.quantity * unitCost;

          acc.totalQuantity += item.quantity;
          acc.totalRevenue += lineTotal;
          acc.totalCost += lineCost;
          acc.totalProfit += lineTotal - lineCost;
          const transactionId = item.transactionId ?? (item as { transaction?: { id?: string } }).transaction?.id;
          if (transactionId) acc.transactionIds.add(transactionId);
          return acc;
        },
        {
          totalQuantity: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
          transactionIds: new Set<string>(),
        },
      );

      return NextResponse.json({
        history,
        summary: {
          totalQuantity: summary.totalQuantity,
          totalRevenue: summary.totalRevenue,
          totalCost: summary.totalCost,
          totalProfit: summary.totalProfit,
          averageSellingPrice: summary.totalQuantity > 0 ? summary.totalRevenue / summary.totalQuantity : 0,
          totalTransactions: summary.transactionIds.size,
        },
        pagination: {
          total,
          page,
          limit: fetchAll ? total : limit,
          totalPages: fetchAll ? 1 : Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("GET /api/products/[id]/sales-history error:", error);
      return NextResponse.json({ error: "Terjadi kesalahan saat mengambil riwayat penjualan produk" }, { status: 500 });
    }
  },
  { requireStore: true },
);
