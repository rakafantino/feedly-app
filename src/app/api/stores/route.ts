import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import prisma from '@/lib/prisma';

// GET /api/stores
// Mendapatkan daftar toko (hanya untuk admin)
export const GET = withAuth(async (request: NextRequest, session) => {
  try {
    // Hanya admin yang bisa melihat semua toko
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Akses ditolak. Hanya admin yang dapat mengakses daftar toko.' },
        { status: 403 }
      );
    }

    const stores = await prisma.store.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            users: true,
            products: true,
            transactions: true
          }
        }
      }
    });

    return NextResponse.json({ stores });
  } catch (error) {
    console.error('GET /api/stores error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data toko' },
      { status: 500 }
    );
  }
}, { requiredRoles: ['admin'] });

// POST /api/stores
// Membuat toko baru (hanya untuk admin)
export const POST = withAuth(async (request: NextRequest, session) => {
  try {
    // Hanya admin yang bisa membuat toko baru
    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Akses ditolak. Hanya admin yang dapat membuat toko baru.' },
        { status: 403 }
      );
    }

    const data = await request.json();

    // Validasi data
    if (!data.name) {
      return NextResponse.json(
        { error: 'Nama toko harus diisi' },
        { status: 400 }
      );
    }

    // Cek apakah nama toko sudah digunakan
    const existingStore = await prisma.store.findFirst({
      where: { name: data.name }
    });

    if (existingStore) {
      return NextResponse.json(
        { error: 'Nama toko sudah digunakan' },
        { status: 400 }
      );
    }

    // Buat toko baru
    const store = await prisma.store.create({
      data: {
        name: data.name,
        description: data.description || null,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        isActive: true
      }
    });

    return NextResponse.json({ store }, { status: 201 });
  } catch (error) {
    console.error('POST /api/stores error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membuat toko baru' },
      { status: 500 }
    );
  }
}, { requiredRoles: ['admin'] }); 