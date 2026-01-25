
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const storeId = url.searchParams.get('storeId') || session.user.storeId;
    const startDateParam = url.searchParams.get('startDate');
    const endDateParam = url.searchParams.get('endDate');
    const typeParam = url.searchParams.get('type');

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
    }

    const startDate = startDateParam ? startOfDay(new Date(startDateParam)) : startOfDay(new Date());
    const endDate = endDateParam ? endOfDay(new Date(endDateParam)) : endOfDay(new Date());

    const whereClause: any = {
      storeId,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    };

    if (typeParam && typeParam !== 'ALL') {
      whereClause.type = typeParam;
    }

    const adjustments = await prisma.stockAdjustment.findMany({
      where: whereClause,
      include: {
        product: {
          select: { name: true, unit: true }
        },
        batch: {
          select: { batchNumber: true, expiryDate: true }
        },
        createdBy: {
          select: { name: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate Summary
    const summary = {
      totalItems: 0,
      totalLossValue: 0,
      totalCorrectionValue: 0
    };

    adjustments.forEach(adj => {
       summary.totalItems += Math.abs(adj.quantity);
       if (adj.totalValue < 0) {
         summary.totalLossValue += Math.abs(adj.totalValue);
       } else {
         summary.totalCorrectionValue += adj.totalValue;
       }
    });

    return NextResponse.json({
      adjustments,
      summary
    });

  } catch (error) {
    console.error('[API] Report Adjustment Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
