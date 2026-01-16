import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';

// Get a transaction by ID
export const GET = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    const pathname = request.nextUrl.pathname;
    const id = pathname.split('/').pop();

    if (!id) {
        return NextResponse.json(
            { error: "Transaction ID is required" },
            { status: 400 }
        );
    }

    const transaction = await prisma.transaction.findUnique({
      where: { 
        id,
        ...(storeId ? { storeId } : {})
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!transaction) {
      return NextResponse.json(
        { error: 'Transaction not found or you do not have permission' },
        { status: 404 }
      );
    }

    return NextResponse.json({ transaction }, { status: 200 });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}, { requireStore: true }); 