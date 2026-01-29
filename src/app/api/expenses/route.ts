import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// Zod Schema for Expense Creation
const expenseCreateSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
  date: z.string().datetime().optional(), // ISO 8601 string
});

/**
 * POST /api/expenses - Create a new expense
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = session.user.storeId;
    if (!storeId) {
      return NextResponse.json({ error: 'Store not selected' }, { status: 400 });
    }

    const body = await req.json();
    const validation = expenseCreateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { amount, category, description, date } = validation.data;

    const expense = await prisma.expense.create({
      data: {
        storeId,
        amount,
        category,
        description: description || null,
        date: date ? new Date(date) : new Date(),
        createdById: session.user.id || null,
      },
    });

    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/expenses] Error:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}

/**
 * GET /api/expenses - List expenses
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = session.user.storeId;
    if (!storeId) {
      return NextResponse.json({ expenses: [] }); // Return empty if no store
    }

    const url = new URL(req.url);
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    const category = url.searchParams.get('category');

    // Build where clause
    const where: Record<string, unknown> = { storeId };

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

    if (category) {
      where.category = category;
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        createdBy: {
          select: { id: true, name: true }
        }
      }
    });

    return NextResponse.json({ expenses });
  } catch (error) {
    console.error('[GET /api/expenses] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}
