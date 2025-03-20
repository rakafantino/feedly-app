import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import * as bcryptjs from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { name, email, password: userPassword } = data;
    
    // Validasi input
    if (!name || !email || !userPassword) {
      return NextResponse.json(
        { error: 'Nama, email, dan password diperlukan' },
        { status: 400 }
      );
    }
    
    // Cek apakah email sudah terdaftar
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email sudah terdaftar' },
        { status: 400 }
      );
    }
    
    // Hash password
    const hashedPassword = await bcryptjs.hash(userPassword, 10);
    
    // Buat user baru (default role: CASHIER)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'CASHIER' // Default role
      }
    });
    
    // Hapus password dari respons
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...userWithoutPassword } = user;
    
    return NextResponse.json(
      { user: userWithoutPassword, message: 'Registrasi berhasil' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Kesalahan registrasi:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat registrasi' },
      { status: 500 }
    );
  }
} 