
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { NotificationService } from '@/services/notification.service';

export const GET = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    // Run checks
    const [stockResult, , expiredResult] = await Promise.all([
        NotificationService.checkLowStockProducts(storeId as string),
        NotificationService.checkDebtDue(storeId as string),
        NotificationService.checkExpiredProducts(storeId as string)
    ]);

    return NextResponse.json({ 
        success: true, 
        processed: {
            stock: stockResult.count,
            expired: expiredResult.count,
            debt: 'checked'
        }
    });
  } catch (error) {
    console.error('Error running notification checks:', error);
    return NextResponse.json(
      { error: 'Failed to run notification checks' },
      { status: 500 }
    );
  }
}, { requireStore: true });
