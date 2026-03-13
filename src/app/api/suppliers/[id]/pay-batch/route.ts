import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';
import { z } from 'zod';

const payBatchSchema = z.object({
  amount: z.number().positive("Nominal pembayaran harus lebih dari 0"),
  notes: z.string().optional(),
});

export const POST = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    const pathname = request.nextUrl.pathname;
    const segments = pathname.split('/');
    const supplierId = segments[segments.length - 2]; // /api/suppliers/[id]/pay-batch

    if (!supplierId) {
      return NextResponse.json(
        { error: "ID supplier tidak valid" },
        { status: 400 }
      );
    }

    if (!storeId) {
      return NextResponse.json(
        { error: "Store ID tidak ditemukan" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const result = payBatchSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validasi gagal", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { amount } = result.data;

    // Check if supplier exists
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: supplierId,
        storeId
      }
    });

    if (!supplier) {
      return NextResponse.json(
        { error: "Supplier tidak ditemukan" },
        { status: 404 }
      );
    }

    // Get all unpaid POs for this supplier, ordered by oldest first
    const unpaidPOs = await prisma.purchaseOrder.findMany({
      where: {
        supplierId,
        storeId,
        remainingAmount: { gt: 0 }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    if (unpaidPOs.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada hutang yang perlu dibayar untuk supplier ini" },
        { status: 400 }
      );
    }

    const totalDebt = unpaidPOs.reduce((sum, po) => sum + po.remainingAmount, 0);
    if (amount > totalDebt) {
      return NextResponse.json(
        { error: `Nominal pembayaran melebihi total hutang (Rp ${totalDebt.toLocaleString('id-ID')})` },
        { status: 400 }
      );
    }

    let remainingPayment = amount;
    const poUpdates = [];

    for (const po of unpaidPOs) {
      if (remainingPayment <= 0) break;

      const paymentForThisPO = Math.min(remainingPayment, po.remainingAmount);
      const newRemainingAmount = po.remainingAmount - paymentForThisPO;
      const newAmountPaid = po.amountPaid + paymentForThisPO;
      const newPaymentStatus = newRemainingAmount <= 0 ? 'PAID' : 'PARTIAL';

      poUpdates.push(
        prisma.purchaseOrder.update({
          where: { id: po.id },
          data: {
            remainingAmount: newRemainingAmount,
            amountPaid: newAmountPaid,
            paymentStatus: newPaymentStatus
          }
        })
      );

      remainingPayment -= paymentForThisPO;
    }

    // Execute transaction
    await prisma.$transaction(poUpdates);

    return NextResponse.json({
      message: "Pembayaran berhasil diproses",
      amountPaid: amount
    });

  } catch (error) {
    console.error(`POST /api/suppliers/[id]/pay-batch error:`, error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat memproses pembayaran' },
      { status: 500 }
    );
  }
}, { requireStore: true });
