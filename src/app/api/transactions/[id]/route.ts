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

// Update transaction (e.g. Due Date)
export const PATCH = withAuth(async (request: NextRequest, session, storeId) => {
  try {
     const pathname = request.nextUrl.pathname;
     const id = pathname.split('/').pop();

     if (!id) {
         return NextResponse.json({ error: "Transaction ID is required" }, { status: 400 });
     }

     const body = await request.json();
     
     // Only allow specific fields for now
     const updateData: { dueDate?: Date } = {};
     if (body.dueDate) {
         updateData.dueDate = new Date(body.dueDate);
     }

     if (Object.keys(updateData).length === 0) {
         return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
     }

     const updatedTransaction = await prisma.transaction.update({
        where: { id, storeId: storeId! }, // storeId is required by withAuth middleware { requireStore: true }
        data: updateData
     });
     
     return NextResponse.json({ transaction: updatedTransaction }, { status: 200 });
  } catch (error) {
     console.error('Error updating transaction:', error);
     return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}, { requireStore: true });

export async function OPTIONS(request: NextRequest) {
  const allowedOrigins = request.headers.get('origin');
  const headers = {
    'Access-Control-Allow-Origin': allowedOrigins || '*',
    'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  return new NextResponse(null, { headers });
}