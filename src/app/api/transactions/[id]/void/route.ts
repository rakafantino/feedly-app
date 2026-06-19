import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';
import { sanitizeQuantity } from '@/lib/utils';
import { StockMutationService } from '@/services/stock-mutation.service';

function buildVoidBatchNumber(invoiceNumber: string | null | undefined, productId: string) {
  const invoicePart = invoiceNumber?.replace(/[^a-zA-Z0-9-]/g, '-') || 'NO-INVOICE';
  return `VOID-${invoicePart}-${productId.slice(-4)}`;
}

export const POST = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    const pathname = request.nextUrl.pathname;
    const pathParts = pathname.split('/');
    // Extract the ID which is before the 'void' segment
    const id = pathParts[pathParts.length - 2]; 

    if (!id) {
      return NextResponse.json({ error: "Transaction ID is required" }, { status: 400 });
    }

    const transaction = await prisma.transaction.findFirst({
      where: { id, storeId: storeId! },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                supplierId: true,
                expiry_date: true,
                purchase_price: true,
                hpp_price: true,
              },
            },
          },
        },
      }
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.status === 'VOIDED') {
      return NextResponse.json({ error: 'Transaction is already voided' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Mark transaction as voided
      await tx.transaction.update({
        where: { id },
        data: { status: 'VOIDED' }
      });

      // 2. Restore stock for each item
      for (const item of transaction.items) {
        if (item.quantity <= 0) continue;

        const incrementQuantity = sanitizeQuantity(Number(item.quantity) || 0);

        await StockMutationService.createBatch(
          item.productId,
          incrementQuantity,
          {
            batchNumber: buildVoidBatchNumber(transaction.invoiceNumber, item.productId),
            purchasePrice: item.cost_price ?? item.product.hpp_price ?? item.product.purchase_price ?? 0,
            expiryDate: item.product.expiry_date,
            supplierId: item.product.supplierId,
            inDate: new Date(),
          },
          tx,
        );

        // Product stock is automatically incremented by createBatch above.
      }
    });

    return NextResponse.json({ message: 'Transaction voided successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error voiding transaction:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}, { requireStore: true });
