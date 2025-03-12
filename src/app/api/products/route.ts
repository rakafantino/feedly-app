import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET /api/products
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json(
        { error: "Tidak memiliki akses" },
        { status: 401 }
      );
    }

    // Ambil parameter query
    const url = new URL(request.url);
    const searchQuery = url.searchParams.get('search') || '';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const category = url.searchParams.get('category') || undefined;
    
    // Hitung offset untuk pagination
    const skip = (page - 1) * limit;

    // Buat query filter
    const where: any = {
      // Tampilkan hanya produk yang belum dihapus (soft delete)
      isDeleted: false
    };
    
    if (searchQuery) {
      where.OR = [
        { name: { contains: searchQuery } },
        { barcode: { contains: searchQuery } }
      ];
    }

    if (category) {
      where.category = category;
    }

    // Dapatkan total items untuk pagination
    const totalProducts = await prisma.product.count({ where });
    
    // Dapatkan produk dengan pagination
    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: limit
    });

    // Hitung total halaman
    const totalPages = Math.ceil(totalProducts / limit);

    return NextResponse.json({
      products,
      pagination: {
        total: totalProducts,
        page,
        limit,
        totalPages
      }
    });
  } catch (error) {
    console.error('GET /api/products error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data produk' },
      { status: 500 }
    );
  }
}

// POST /api/products
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json(
        { error: "Tidak memiliki akses" },
        { status: 401 }
      );
    }

    const data = await request.json();

    // Validasi data
    if (!data.name) {
      return NextResponse.json(
        { error: "Nama produk harus diisi" },
        { status: 400 }
      );
    }

    if (data.price < 0) {
      return NextResponse.json(
        { error: "Harga tidak boleh negatif" },
        { status: 400 }
      );
    }

    if (data.stock < 0) {
      return NextResponse.json(
        { error: "Stok tidak boleh negatif" },
        { status: 400 }
      );
    }

    // Buat produk baru
    const product = await prisma.product.create({
      data: {
        name: data.name,
        description: data.description || null,
        barcode: data.barcode || null,
        category: data.category || null,
        price: data.price,
        stock: data.stock,
        unit: data.unit
      }
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error('POST /api/products error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menambahkan produk' },
      { status: 500 }
    );
  }
} 