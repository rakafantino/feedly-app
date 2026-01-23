import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const storeId = searchParams.get('storeId') || session.user?.storeId;

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID required' }, { status: 400 });
    }

    // Default to today if no date range provided
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startDate = startDateParam ? new Date(startDateParam) : today;
    const endDate = endDateParam ? new Date(endDateParam) : tomorrow;
    
    // Ensure endDate includes the full day if it's just a date string
    if (endDateParam && !endDateParam.includes('T')) {
        endDate.setHours(23, 59, 59, 999);
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        storeId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        customer: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    let totalRevenue = 0;
    let totalCost = 0;

    const reportData = transactions.map(tx => {
      let txCost = 0;
      
      tx.items.forEach(item => {
        // Use historical cost_price first, fallback to current purchase_price, then estimate
        /* @ts-ignore */
        const unitCost = item.cost_price ?? item.product?.purchase_price ?? (item.price * 0.7);
        txCost += unitCost * item.quantity;
      });

      const txProfit = tx.total - txCost;
      
      totalRevenue += tx.total;
      totalCost += txCost;

      return {
        id: tx.id,
        invoiceNumber: tx.invoiceNumber,
        date: tx.createdAt,
        customerName: tx.customer?.name || 'Guest',
        paymentMethod: tx.paymentMethod,
        itemCount: tx.items.reduce((sum, item) => sum + item.quantity, 0),
        total: tx.total,
        cost: txCost,
        profit: txProfit,
        marginPercent: tx.total > 0 ? (txProfit / tx.total) * 100 : 0
      };
    });

    const totalProfit = totalRevenue - totalCost;
    const grossMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return NextResponse.json({
      summary: {
        totalTransactions: transactions.length,
        totalRevenue,
        totalCost,
        totalProfit,
        grossMargin
      },
      transactions: reportData
    });

  } catch (error) {
    console.error('Error fetching sales report:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
