import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';

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
      include: { items: true }
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
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } }
        });
      }
    });

    return NextResponse.json({ message: 'Transaction voided successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error voiding transaction:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}, { requireStore: true });
