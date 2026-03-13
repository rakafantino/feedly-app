import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

// Zod Schema for Capital Transaction Update
const capitalUpdateSchema = z.object({
  amount: z.number().positive('Amount must be positive').optional(),
  type: z.enum(['INJECTION', 'WITHDRAWAL']).optional(),
  notes: z.string().optional(),
  date: z.string().datetime().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update'
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * PUT /api/capital/[id] - Update a capital transaction
 */
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = session.user.storeId;
    const { id } = await context.params;

    // Check if transaction exists
    const existingTransaction = await prisma.capitalTransaction.findFirst({
      where: { id }
    });

    if (!existingTransaction) {
      return NextResponse.json({ error: 'Capital transaction not found' }, { status: 404 });
    }

    // Check if transaction belongs to user's store
    if (existingTransaction.storeId !== storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const validation = capitalUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { amount, type, notes, date } = validation.data;

    const updateData: Record<string, unknown> = {};
    if (amount !== undefined) updateData.amount = amount;
    if (type !== undefined) updateData.type = type;
    if (notes !== undefined) updateData.notes = notes;
    if (date !== undefined) updateData.date = new Date(date);

    const capitalTransaction = await prisma.capitalTransaction.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json({ capitalTransaction });
  } catch (error) {
    console.error('[PUT /api/capital/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to update capital transaction' }, { status: 500 });
  }
}

/**
 * DELETE /api/capital/[id] - Delete a capital transaction
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storeId = session.user.storeId;
    const { id } = await context.params;

    // Check if transaction exists
    const existingTransaction = await prisma.capitalTransaction.findFirst({
      where: { id }
    });

    if (!existingTransaction) {
      return NextResponse.json({ error: 'Capital transaction not found' }, { status: 404 });
    }

    // Check if transaction belongs to user's store
    if (existingTransaction.storeId !== storeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.capitalTransaction.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/capital/[id]] Error:', error);
    return NextResponse.json({ error: 'Failed to delete capital transaction' }, { status: 500 });
  }
}