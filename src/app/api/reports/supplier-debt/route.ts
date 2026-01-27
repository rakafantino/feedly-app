
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';

export const GET = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    // Fetch unpaid/partial Purchase Orders with Supplier details
    const debts = await prisma.purchaseOrder.findMany({
      where: {
        storeId: storeId as string,
        paymentStatus: {
          in: ['UNPAID', 'PARTIAL']
        },
        remainingAmount: {
          gt: 0
        }
      },
      select: {
        id: true,
        poNumber: true,
        createdAt: true,
        dueDate: true,
        totalAmount: true,
        amountPaid: true,
        remainingAmount: true,
        paymentStatus: true,
        status: true,
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true
          }
        }
      },
      orderBy: [
        { dueDate: 'asc' }, // Prioritize due dates
        { createdAt: 'asc' }
      ]
    });

    const reportData = debts.map(po => ({
      id: po.id,
      poNumber: po.poNumber,
      date: po.createdAt,
      dueDate: po.dueDate,
      supplierId: po.supplier.id,
      supplierName: po.supplier.name,
      contactInfo: po.supplier.phone || po.supplier.email || '-',
      totalAmount: po.totalAmount,
      amountPaid: po.amountPaid,
      remainingAmount: po.remainingAmount,
      paymentStatus: po.paymentStatus,
      status: po.status
    }));

    return NextResponse.json(reportData);
  } catch (error) {
    console.error('[SUPPLIER_DEBT_REPORT_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
});
