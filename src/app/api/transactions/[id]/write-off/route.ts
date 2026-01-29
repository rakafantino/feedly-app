import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { TransactionService } from '@/services/transaction.service';
import { z } from 'zod';

const writeOffSchema = z.object({
  reason: z.string().optional(),
});

// POST /api/transactions/[id]/write-off
export const POST = withAuth(async (
  request: NextRequest,
  session,
  storeId,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    
    const validation = writeOffSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await TransactionService.writeOffDebt(
      storeId!,
      id,
      validation.data.reason
    );

    return NextResponse.json({
      message: 'Piutang berhasil dihapus (write-off)',
      transaction: result
    });
  } catch (error: any) {
    console.error('POST /api/transactions/[id]/write-off error:', error);
    
    // Handle known business errors
    const isBusinessError = 
      error.message.includes('not found') ||
      error.message.includes('already written off') ||
      error.message.includes('no remaining debt');

    return NextResponse.json(
      { error: error.message || 'Terjadi kesalahan saat menghapus piutang' },
      { status: isBusinessError ? 400 : 500 }
    );
  }
}, { requireStore: true });
