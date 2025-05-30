import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';

// GET /api/suppliers
// Mengambil semua supplier
export const GET = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    // Filter berdasarkan toko
    let where = {};
    if (storeId) {
      where = { storeId };
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json({ suppliers });
  } catch (error) {
    console.error('GET /api/suppliers error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data supplier' },
      { status: 500 }
    );
  }
}, { requireStore: true });

// POST /api/suppliers
// Membuat supplier baru
export const POST = withAuth(async (request: NextRequest, session, storeId) => {
  try {
    // Pastikan storeId tersedia
    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID diperlukan untuk membuat supplier' },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // Validasi input
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { error: "Nama supplier wajib diisi" },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: body.name.trim(),
        email: body.email ? body.email.trim() : null,
        phone: body.phone ? body.phone.trim() : null,
        address: body.address ? body.address.trim() : null,
        storeId: storeId // Tambahkan storeId
      }
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (error) {
    console.error('POST /api/suppliers error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membuat supplier baru' },
      { status: 500 }
    );
  }
}, { requireStore: true }); 