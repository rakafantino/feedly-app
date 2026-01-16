import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET /api/categories
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json(
        { error: "Tidak memiliki akses" },
        { status: 401 }
      );
    }

    // Dapatkan storeId dari session, cookie, atau query params
    let storeId = session.user?.storeId || null;
    
    // Coba dapatkan dari cookies jika tidak ada di session
    if (!storeId) {
      const requestCookies = req.cookies;
      const storeCookie = requestCookies.get('selectedStoreId');
      if (storeCookie) {
        storeId = storeCookie.value;
      }
    }
    
    // Coba dapatkan dari query param jika masih tidak ada
    if (!storeId) {
      const url = new URL(req.url);
      const queryStoreId = url.searchParams.get('storeId');
      if (queryStoreId) {
        storeId = queryStoreId;
      }
    }

    // Mengambil produk yang sesuai dengan storeId, hanya kolom category yang unik
    const distinctCategories = await prisma.product.findMany({
      where: {
        ...(storeId ? { storeId } : {}),
        isDeleted: false,
        category: { not: '' } // Abaikan kategori kosong
      },
      select: {
        category: true
      },
      distinct: ['category']
    });
    
    // Ekstrak kategori menjadi array string
    const categories = distinctCategories
      .map(p => p.category)
      .filter((c): c is string => c !== null);
    
    // Urutkan kategori secara alfabetis
    categories.sort();

    return NextResponse.json({ categories, storeId });
  } catch (error) {
    console.error('GET /api/categories error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data kategori' },
      { status: 500 }
    );
  }
} 