import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET /api/suppliers
// Mengambil semua supplier
export async function GET() {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json(
        { error: "Tidak memiliki akses" },
        { status: 401 }
      );
    }

    const suppliers = await prisma.supplier.findMany({
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
}

// POST /api/suppliers
// Membuat supplier baru
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json(
        { error: "Tidak memiliki akses" },
        { status: 401 }
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
        address: body.address ? body.address.trim() : null
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
} 