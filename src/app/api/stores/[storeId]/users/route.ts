import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import prisma from '@/lib/prisma';
import bcryptjs from 'bcryptjs';

// GET /api/stores/[id]/users
// Mendapatkan daftar pengguna dalam toko tertentu (untuk admin)
export const GET = withAuth(async (request: NextRequest, session) => {
  try {
    // Ambil parameters dari URL path
    const storeId = request.nextUrl.pathname.split('/')[3];

    if (!storeId) {
      return NextResponse.json(
        { error: 'ID toko diperlukan' },
        { status: 400 }
      );
    }

    // Hanya OWNER yang bisa melihat pengguna dari toko
    if (session.user.role !== 'OWNER') {
      // Jika bukan admin, hanya bisa melihat pengguna dari toko mereka sendiri
      if (session.user.storeId !== storeId) {
        return NextResponse.json(
          { error: 'Akses ditolak. Anda hanya dapat melihat pengguna di toko Anda sendiri.' },
          { status: 403 }
        );
      }
    }

    // Pastikan toko ada
    const store = await prisma.store.findUnique({
      where: { id: storeId }
    });

    if (!store) {
      return NextResponse.json(
        { error: 'Toko tidak ditemukan' },
        { status: 404 }
      );
    }

    // Ambil pengguna dari toko tersebut
    const users = await prisma.user.findMany({
      where: { storeId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('GET /api/stores/[id]/users error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data pengguna' },
      { status: 500 }
    );
  }
});

// POST /api/stores/[id]/users
// Menambahkan pengguna ke toko tertentu (untuk admin)
export const POST = withAuth(async (request: NextRequest, session) => {
  try {
    // Ambil parameters dari URL path
    const storeId = request.nextUrl.pathname.split('/')[3];

    if (!storeId) {
      return NextResponse.json(
        { error: 'ID toko diperlukan' },
        { status: 400 }
      );
    }

    // Hanya OWNER yang bisa menambahkan pengguna ke toko
    if (session.user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Akses ditolak. Hanya Owner yang dapat menambahkan pengguna.' },
        { status: 403 }
      );
    }

    // Pastikan toko ada
    const store = await prisma.store.findUnique({
      where: { id: storeId }
    });

    if (!store) {
      return NextResponse.json(
        { error: 'Toko tidak ditemukan' },
        { status: 404 }
      );
    }

    const data = await request.json();

    // Validasi data
    if (!data.name || !data.email || !data.password || !data.role) {
      return NextResponse.json(
        { error: 'Semua field harus diisi: name, email, password, role' },
        { status: 400 }
      );
    }

    // Validasi role
    if (!['OWNER', 'CASHIER'].includes(data.role.toUpperCase())) {
      return NextResponse.json(
        { error: 'Role tidak valid. Pilih: OWNER atau CASHIER' },
        { status: 400 }
      );
    }

    // Cek apakah email sudah digunakan
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email sudah digunakan' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(data.password, 10);

    // Buat pengguna baru
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role.toUpperCase(),
        storeId
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        storeId: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error('POST /api/stores/[id]/users error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menambahkan pengguna' },
      { status: 500 }
    );
  }
}, { requiredRoles: ['OWNER'] }); 