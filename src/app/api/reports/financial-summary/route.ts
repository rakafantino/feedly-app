import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { FinanceService } from '@/services/finance.service';

/**
 * GET /api/reports/financial-summary
 * 
 * Returns P&L summary for a store within a date range.
 * Query params:
 *   - startDate: YYYY-MM-DD (default: first day of current month)
 *   - endDate: YYYY-MM-DD (default: today)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = session.user.storeId;
    if (!storeId) {
      return NextResponse.json({ error: 'Store not selected' }, { status: 400 });
    }

    const url = new URL(req.url);
    const startDateParam = url.searchParams.get('startDate');
    const endDateParam = url.searchParams.get('endDate');

    // Default: current month
    const today = new Date();
    const defaultStartDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const defaultEndDate = today;

    const startDate = startDateParam ? new Date(startDateParam) : defaultStartDate;
    const endDate = endDateParam ? new Date(endDateParam) : defaultEndDate;

    const summary = await FinanceService.calculateFinancialSummary(storeId, startDate, endDate);

    return NextResponse.json({
      summary,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      }
    });
  } catch (error) {
    console.error('[GET /api/reports/financial-summary] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch financial summary' }, { status: 500 });
  }
}
