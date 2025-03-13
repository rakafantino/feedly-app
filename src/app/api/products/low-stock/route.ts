import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET() {
  try {
    // Verifikasi autentikasi
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Ambil produk dengan stok di bawah threshold
    const lowStockProducts = await prisma.product.findMany({
      where: {
        // Filter produk yang telah dihapus
        isDeleted: false,
        OR: [
          // Produk dengan threshold yang ditentukan dan stok <= threshold
          {
            NOT: { threshold: null },
            stock: {
              lte: prisma.product.fields.threshold
            }
          },
          // Produk tanpa threshold tapi stok <= 5 (default threshold)
          {
            threshold: null,
            stock: { lte: 5 }
          }
        ]
      },
      orderBy: {
        stock: 'asc'
      }
    });

    return NextResponse.json({ 
      products: lowStockProducts,
      count: lowStockProducts.length
    });
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch low stock products' },
      { status: 500 }
    );
  }
} 