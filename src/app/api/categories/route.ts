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

    // Mengambil produk yang sesuai dengan storeId
    const products = await prisma.product.findMany({
      where: {
        ...(storeId ? { storeId } : {}),
        isDeleted: false
      },
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

    return NextResponse.json({ categories, storeId });
  } catch (error) {
    console.error('GET /api/categories error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data kategori' },
      { status: 500 }
    );
  }
} 