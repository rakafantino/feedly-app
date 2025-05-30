import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const { storeId } = body;

    if (!storeId) {
      return NextResponse.json({ error: "Store ID is required" }, { status: 400 });
    }

    // Verifikasi bahwa toko ada dan aktif
    const store = await prisma.store.findUnique({
      where: {
        id: storeId,
        isActive: true
      }
    });

    if (!store) {
      return NextResponse.json({ error: "Store not found or inactive" }, { status: 404 });
    }

    // Untuk admin, bisa langsung memilih toko apa saja
    if (session.user.role === "admin") {
      // Buat response dengan cookie
      const response = NextResponse.json({ success: true, store });
      response.cookies.set("selectedStoreId", storeId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24, // 1 hari
        path: "/"
      });
      
      return response;
    }

    // Untuk non-admin, verifikasi bahwa pengguna memiliki akses ke toko tersebut
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
        storeId: storeId
      }
    });

    if (!user) {
      return NextResponse.json({ error: "You do not have access to this store" }, { status: 403 });
    }

    // Buat response dengan cookie
    const response = NextResponse.json({ success: true, store });
    response.cookies.set("selectedStoreId", storeId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24, // 1 hari
      path: "/"
    });

    // Update user dengan storeId yang dipilih
    await prisma.user.update({
      where: { id: userId },
      data: { storeId }
    });

    return response;
  } catch (error) {
    console.error("Error selecting store:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
} 