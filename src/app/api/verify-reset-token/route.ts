import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    // Mengambil token dari query parameters
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "Token tidak ditemukan" },
        { status: 400 }
      );
    }

    // Mencari token di database
    const resetRecord = await prisma.passwordReset.findFirst({
      where: { 
        token,
        expiresAt: { gt: new Date() } // Token belum kedaluwarsa
      },
      include: {
        user: true
      }
    });

    if (!resetRecord) {
      return NextResponse.json(
        { valid: false, error: "Token tidak valid atau sudah kedaluwarsa" },
        { status: 400 }
      );
    }

    // Token valid dan belum kedaluwarsa
    return NextResponse.json({ valid: true, email: resetRecord.user.email });
  } catch (error) {
    console.error("Error verifying reset token:", error);
    return NextResponse.json(
      { valid: false, error: "Terjadi kesalahan saat memverifikasi token" },
      { status: 500 }
    );
  }
} 