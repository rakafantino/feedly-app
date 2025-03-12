import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    // Validasi input
    if (!token || !password) {
      return NextResponse.json(
        { error: "Token dan password baru diperlukan" },
        { status: 400 }
      );
    }

    // Pastikan password tidak terlalu pendek
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password minimal 6 karakter" },
        { status: 400 }
      );
    }

    // Cari token di database
    const resetRecord = await prisma.passwordReset.findFirst({
      where: {
        token,
        expiresAt: { gt: new Date() } // Token belum kedaluwarsa
      }
    });

    // Jika token tidak valid atau sudah kedaluwarsa
    if (!resetRecord) {
      return NextResponse.json(
        { error: "Token tidak valid atau sudah kedaluwarsa" },
        { status: 400 }
      );
    }

    // Hash password baru
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password user
    await prisma.user.update({
      where: {
        id: resetRecord.userId,
      },
      data: {
        password: hashedPassword,
      },
    });

    // Hapus token yang sudah digunakan
    await prisma.passwordReset.delete({
      where: {
        id: resetRecord.id,
      },
    });

    return NextResponse.json(
      { message: "Password berhasil direset" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat mereset password" },
      { status: 500 }
    );
  }
} 