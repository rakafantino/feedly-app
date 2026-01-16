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

    const storeId = session.user.storeId; // Assuming storeId is available in the session
    
    if (!storeId) {
       return NextResponse.json(
        { error: "Store ID unavailable" },
        { status: 400 }
      );
    }

    // Ambil produk dengan stok di bawah threshold
    const lowStockProducts = await prisma.product.findMany({
      where: {
        storeId: storeId,
        // Filter produk yang telah dihapus
        isDeleted: false,
        OR: [
          {
            // Jika threshold ditentukan per produk
            AND: [
              { threshold: { not: null } },
              { stock: { lte: prisma.product.fields.threshold } }
            ]
          },
          {
            // Jika threshold null, gunakan default (misal 5)
            AND: [
              { threshold: null },
              { stock: { lte: 5 } }
            ]
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