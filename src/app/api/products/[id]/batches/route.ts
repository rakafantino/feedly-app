import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/products/[id]/batches
 * Get all batches for a product
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: productId } = await params;

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Get all batches for this product
    const batches = await prisma.productBatch.findMany({
      where: { productId },
      orderBy: [
        { expiryDate: 'asc' },
        { createdAt: 'desc' }
      ],
      select: {
        id: true,
        stock: true,
        expiryDate: true,
        batchNumber: true,
        purchasePrice: true,
        createdAt: true
      }
    });

    return NextResponse.json({ batches });
  } catch (error) {
    console.error('[API] Get Product Batches Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
