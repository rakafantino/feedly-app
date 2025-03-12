import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET /api/categories
export async function GET() {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json(
        { error: "Tidak memiliki akses" },
        { status: 401 }
      );
    }

    // Mengambil semua produk
    const products = await prisma.product.findMany({
      select: {
        category: true
      }
    });
    
    // Ekstrak kategori yang unik
    const categories = [...new Set(
      products
        .map(product => product.category)
        .filter((category): category is string => 
          category !== null && category !== ''
        )
    )];
    
    // Urutkan kategori secara alfabetis
    categories.sort();

    return NextResponse.json({ categories });
  } catch (error) {
    console.error('GET /api/categories error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data kategori' },
      { status: 500 }
    );
  }
} 