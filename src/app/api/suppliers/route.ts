import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api-middleware';
import { supplierSchema } from '@/lib/validations/supplier';

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

    const result = supplierSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validasi gagal", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const data = result.data;

    const supplier = await prisma.supplier.create({
      data: {
        name: data.name,
        code: data.code,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        storeId: storeId // Tambahkan storeId
      }
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/suppliers error:', error);

    // Check for unique constraint violation
    if (error.code === 'P2002' && error.meta?.target?.includes('code')) {
      return NextResponse.json(
        { error: 'Kode Supplier sudah digunakan oleh supplier lain' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membuat supplier baru' },
      { status: 500 }
    );
  }
}, { requireStore: true }); 