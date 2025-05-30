import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';

// GET /api/products
export const GET = withAuth(async (request: NextRequest, session, storeId) => {
  try {
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
      isDeleted: false,
      // Filter berdasarkan toko
      storeId: storeId
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
      take: limit,
      include: {
        supplier: {
          select: {
            id: true,
            name: true
          }
        }
      }
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
}, { requireStore: true });

// POST /api/products
export const POST = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    if (!storeId) {
      return NextResponse.json(
        { error: "Store ID diperlukan untuk membuat produk" },
        { status: 400 }
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

    // Validasi jika supplier ada
    if (data.supplier_id) {
      const supplier = await prisma.supplier.findUnique({
        where: {
          id: data.supplier_id,
          storeId: storeId
        }
      });

      if (!supplier) {
        return NextResponse.json(
          { error: "Supplier tidak ditemukan atau tidak termasuk dalam toko Anda" },
          { status: 400 }
        );
      }
    }

    // Validasi barcode unik dalam toko yang sama jika diisi
    if (data.barcode) {
      const existingProduct = await prisma.product.findFirst({
        where: {
          barcode: data.barcode,
          storeId: storeId,
          isDeleted: false
        }
      });

      if (existingProduct) {
        return NextResponse.json(
          { error: "Barcode sudah digunakan oleh produk lain di toko Anda" },
          { status: 400 }
        );
      }
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
        unit: data.unit,
        threshold: data.threshold || null,
        purchase_price: data.purchase_price || null,
        min_selling_price: data.min_selling_price || null,
        batch_number: data.batch_number || null,
        expiry_date: data.expiry_date || null,
        purchase_date: data.purchase_date || null,
        supplierId: data.supplier_id || null,
        storeId: storeId
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
}, { requireStore: true }); 