
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';
import { z } from 'zod';

const payDebtSchema = z.object({
  amount: z.number().positive(),
  notes: z.string().optional()
});

// PUT /api/purchase-orders/[id]/pay
export const PUT = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    const pathname = request.nextUrl.pathname;
    // Extract ID from /api/purchase-orders/[id]/pay
    const segments = pathname.split('/');
    const purchaseOrderId = segments[segments.length - 2]; 

    if (!purchaseOrderId) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const result = payDebtSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid payment data", details: result.error.flatten() }, { status: 400 });
    }

    const { amount, notes } = result.data;

    // Use transaction to update PO
    const updatedPO = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id: purchaseOrderId, storeId: storeId as string },
      });

      if (!po) {
        throw new Error("Purchase Order not found");
      }

      // Safe casting for legacy types if needed, though prisma generate should have fixed it.
      // We'll trust runtime data.
      const currentPaid = (po as any).amountPaid || 0;
      const total = (po as any).totalAmount || 0;
      
      const newPaid = currentPaid + amount;
      const newRemaining = total - newPaid;

      // Determine status
      let newPaymentStatus = 'PARTIAL';
      if (newRemaining <= 0) {
        newPaymentStatus = 'PAID';
      }

      // Update PO
      const updated = await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          amountPaid: newPaid,
          remainingAmount: newRemaining < 0 ? 0 : newRemaining, // Prevent negative
          paymentStatus: newPaymentStatus,
          updatedAt: new Date(),
          notes: notes ? (po.notes ? po.notes + '\n' : '') + `[Payment Note]: ${notes}` : po.notes
        }
      });
      
      // Optional: Log this payment to a DebtPayment table if we had one linked to POs.
      // Currently we only have DebtPayment linked to Transactions (Customer Sales).
      // For now, updating the PO aggregation is sufficient as per requirements.

      return updated;
    });

    return NextResponse.json({ 
        message: 'Payment recorded', 
        purchaseOrder: updatedPO 
    });

  } catch (error: any) {
    console.error('Error paying debt:', error);
    return NextResponse.json({ error: error.message || "Failed to record payment" }, { status: 500 });
  }
}, { requireStore: true });
