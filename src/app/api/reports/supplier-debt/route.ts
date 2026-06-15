
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';

export const GET = withAuth(async (request: NextRequest, session, storeId) => {
  try {
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
        { dueDate: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    if (debts.length === 0) {
      return NextResponse.json([]);
    }

    const purchaseReturns = await prisma.purchaseReturn.findMany({
      where: {
        storeId: storeId as string,
        purchaseOrderId: { in: debts.map(d => d.id) } // Ambil retur KHUSUS untuk PO yang belum lunas saja
      },
      select: {
        purchaseOrderId: true,
        totalAmount: true
      }
    });

    const returnsByPO = purchaseReturns.reduce((acc, ret) => {
      acc[ret.purchaseOrderId] = (acc[ret.purchaseOrderId] || 0) + ret.totalAmount;
      return acc;
    }, {} as Record<string, number>);

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
      status: po.status,
      totalReturn: returnsByPO[po.id] || 0 // Tembak per PO ID
    }));

    return NextResponse.json(reportData);
  } catch (error) {
    console.error('[SUPPLIER_DEBT_REPORT_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}, { requireStore: true });
