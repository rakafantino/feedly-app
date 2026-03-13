import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// Zod Schema for Capital Transaction Creation
const capitalCreateSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  type: z.enum(['INJECTION', 'WITHDRAWAL'], {
    errorMap: () => ({ message: 'Type must be INJECTION or WITHDRAWAL' }),
  }),
  notes: z.string().optional(),
  date: z.string().datetime().optional(), // ISO 8601 string
});

/**
 * POST /api/capital - Create a new capital transaction
 */
export const POST = withAuth(async (req: NextRequest, session, storeId) => {
  try {
    const body = await req.json();
    const validation = capitalCreateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { amount, type, notes, date } = validation.data;

    const capitalTransaction = await prisma.capitalTransaction.create({
      data: {
        storeId: storeId!,
        amount,
        type,
        notes: notes || null,
        date: date ? new Date(date) : new Date(),
      },
    });

    return NextResponse.json({ capitalTransaction }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/capital] Error:', error);
    return NextResponse.json({ error: 'Failed to create capital transaction' }, { status: 500 });
  }
}, { requireStore: true });

/**
 * GET /api/capital - List capital transactions
 */
export const GET = withAuth(async (req: NextRequest, session, storeId) => {
  try {
    const url = new URL(req.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const type = url.searchParams.get('type');

    // Build where clause
    const where: Record<string, unknown> = { storeId: storeId! };

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        (where.date as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        // End of day for endDate
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        (where.date as Record<string, unknown>).lte = end;
      }
    }

    if (type) {
      where.type = type;
    }

    const capitalTransactions = await prisma.capitalTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ capitalTransactions });
  } catch (error) {
    console.error('[GET /api/capital] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch capital transactions' }, { status: 500 });
  }
}, { requireStore: true });
