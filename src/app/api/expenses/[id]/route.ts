import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// Zod Schema for Expense Update
const expenseUpdateSchema = z.object({
  amount: z.number().positive('Amount must be positive').optional(),
  category: z.string().min(1).optional(),
  description: z.string().optional(),
  date: z.string().datetime().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update'
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * PUT /api/expenses/[id] - Update an expense
 */
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = session.user.storeId;
    const { id } = await context.params;

    // Check if expense exists
    const existingExpense = await prisma.expense.findFirst({
      where: { id }
    });

    if (!existingExpense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Check if expense belongs to user's store
    if (existingExpense.storeId !== storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const validation = expenseUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { amount, category, description, date } = validation.data;

    const updateData: Record<string, unknown> = {};
    if (amount !== undefined) updateData.amount = amount;
    if (category !== undefined) updateData.category = category;
    if (description !== undefined) updateData.description = description;
    if (date !== undefined) updateData.date = new Date(date);

    const expense = await prisma.expense.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ expense });
  } catch (error) {
    console.error('[PUT /api/expenses/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}

/**
 * DELETE /api/expenses/[id] - Delete an expense
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = session.user.storeId;
    const { id } = await context.params;

    // Check if expense exists
    const existingExpense = await prisma.expense.findFirst({
      where: { id }
    });

    if (!existingExpense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Check if expense belongs to user's store
    if (existingExpense.storeId !== storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.expense.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/expenses/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
