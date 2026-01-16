import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { transactionSchema } from '@/lib/validations/transaction';
import { TransactionService } from '@/services/transaction.service';

// Get all transactions
export const GET = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    const transactions = await TransactionService.getTransactions(storeId!);
    return NextResponse.json({ transactions }, { status: 200 });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}, { requireStore: true });

// Create a new transaction
export const POST = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    const body = await request.json();
    
    // Validate input using Zod
    const result = transactionSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validasi gagal", details: result.error.flatten() },
        { status: 400 }
      );
    }
    
    const transaction = await TransactionService.createTransaction(storeId!, result.data);
    return NextResponse.json({ transaction }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating transaction:', error);
    
    // Check for known business errors
    const isBusinessError = error.message && (
      error.message.includes('stock') || 
      error.message.includes('total') || 
      error.message.includes('found')
    );

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: isBusinessError ? 400 : 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}, { requireStore: true });