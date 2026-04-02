import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

export const GET = withAuth(
  async (request: NextRequest, session, storeId) => {
    try {
      const { searchParams } = new URL(request.url);
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");

      if (!startDate || !endDate) {
        return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
      }

      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const transactions = await prisma.transaction.findMany({
        where: {
          storeId: storeId as string,
          createdAt: {
            gte: start,
            lte: end,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      const formattedTransactions = transactions.map((tx) => ({
        id: tx.id,
        invoiceNumber: tx.invoiceNumber || tx.id.slice(0, 8).toUpperCase(),
        total: tx.total,
        amountPaid: tx.amountPaid,
        paymentMethod: tx.paymentMethod,
        createdAt: tx.createdAt.toISOString(),
        items: tx.items.map((item: any) => ({
          id: item.id,
          productName: item.product?.name || "Unknown Product",
          quantity: item.quantity,
          price: item.price,
          subtotal: item.quantity * item.price,
        })),
      }));

      const totalRevenue = transactions.reduce((sum, tx) => sum + tx.total, 0);

      return NextResponse.json({
        transactions: formattedTransactions,
        totalRevenue,
        transactionCount: transactions.length,
      });
    } catch (error) {
      console.error("GET /api/reports/sales-summary error:", error);
      return NextResponse.json({ error: "Terjadi kesalahan saat mengambil data" }, { status: 500 });
    }
  },
  { requireStore: true },
);
