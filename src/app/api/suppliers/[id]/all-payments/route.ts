import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

export const GET = withAuth(
  async (request: NextRequest, session, storeId, context: { params: Promise<{ id: string }> }) => {
    try {
      const supplierId = (await context.params).id;

      if (!supplierId) {
        return NextResponse.json({ error: "ID supplier tidak valid" }, { status: 400 });
      }

      if (!storeId) {
        return NextResponse.json({ error: "Store ID tidak ditemukan" }, { status: 400 });
      }

      // Fetch batch payments
      const batchPayments = await prisma.batchPaymentSession.findMany({
        where: {
          supplierId: supplierId,
          storeId: storeId as string,
        },
        include: {
          payments: {
            include: {
              purchaseOrder: {
                select: { id: true, poNumber: true },
              },
            },
            orderBy: { paidAt: "asc" },
          },
        },
      });

      // Fetch standalone payments (PurchaseOrderPayment with no batchPaymentId)
      // that belong to POs of this supplier
      const standalonePayments = await prisma.purchaseOrderPayment.findMany({
        where: {
          purchaseOrder: {
            supplierId: supplierId,
            storeId: storeId as string,
          },
          batchPaymentId: null,
        },
        include: {
          purchaseOrder: {
            select: { id: true, poNumber: true },
          },
        },
      });

      // Format batch payments
      const formattedBatch = batchPayments.map((bp) => ({
        id: bp.id,
        isBatch: true,
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

      // Format standalone payments to look like single-item batch payments
      const formattedStandalone = standalonePayments.map((p) => ({
        id: p.id,
        isBatch: false,
        totalAmount: p.amount,
        paymentMethod: p.paymentMethod || "CASH",
        notes: p.notes || "Pembayaran langsung via PO",
        createdAt: p.paidAt.toISOString(),
        paymentCount: 1,
        payments: [
          {
            id: p.id,
            amount: p.amount,
            paidAt: p.paidAt.toISOString(),
            poId: p.purchaseOrder?.id,
            poNumber: p.purchaseOrder?.poNumber || "Unknown",
          },
        ],
      }));

      // Merge and sort
      const allPayments = [...formattedBatch, ...formattedStandalone].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return NextResponse.json(allPayments);
    } catch (error) {
      console.error(`GET /api/suppliers/[id]/all-payments error:`, error);
      return NextResponse.json({ error: "Terjadi kesalahan saat mengambil seluruh riwayat pembayaran" }, { status: 500 });
    }
  },
  { requireStore: true }
);