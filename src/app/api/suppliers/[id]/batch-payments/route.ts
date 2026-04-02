import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

export const GET = withAuth(
  async (request: NextRequest, session, storeId) => {
    try {
      const pathname = request.nextUrl.pathname;
      const segments = pathname.split("/");
      const supplierId = segments[segments.length - 2];

      if (!supplierId) {
        return NextResponse.json({ error: "ID supplier tidak valid" }, { status: 400 });
      }

      if (!storeId) {
        return NextResponse.json({ error: "Store ID tidak ditemukan" }, { status: 400 });
      }

      const batchPayments = await prisma.batchPaymentSession.findMany({
        where: {
          supplierId: supplierId,
          storeId: storeId as string,
        },
        include: {
          payments: {
            include: {
              purchaseOrder: {
                select: {
                  id: true,
                  poNumber: true,
                },
              },
            },
            orderBy: {
              paidAt: "asc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const formatted = batchPayments.map((bp) => ({
        id: bp.id,
        totalAmount: bp.totalAmount,
        paymentMethod: bp.paymentMethod,
        notes: bp.notes,
        createdAt: bp.createdAt.toISOString(),
        paymentCount: bp.payments.length,
        payments: bp.payments.map((p) => ({
          id: p.id,
          amount: p.amount,
          paidAt: p.paidAt.toISOString(),
          poId: p.purchaseOrder?.id,
          poNumber: p.purchaseOrder?.poNumber || "Unknown",
        })),
      }));

      return NextResponse.json(formatted);
    } catch (error) {
      console.error(`GET /api/suppliers/[id]/batch-payments error:`, error);
      return NextResponse.json({ error: "Terjadi kesalahan saat mengambil riwayat batch payment" }, { status: 500 });
    }
  },
  { requireStore: true },
);
