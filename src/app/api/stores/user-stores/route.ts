import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const userRole = session.user.role;

    // Jika admin, kembalikan semua toko
    if (userRole === "admin") {
      const stores = await prisma.store.findMany({
        where: {
          isActive: true
        },
        orderBy: {
          name: "asc"
        },
        select: {
          id: true,
          name: true,
          description: true
        }
      });
      return NextResponse.json({ stores });
    }

    // Untuk role lain, ambil toko yang terhubung dengan pengguna
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            description: true,
            isActive: true
          }
        }
      }
    });

    if (!user || !user.store || !user.store.isActive) {
      return NextResponse.json({ stores: [] });
    }

    // Jika user hanya memiliki satu toko, kembalikan itu
    return NextResponse.json({ stores: [user.store] });
  } catch (error) {
    console.error("Error fetching stores:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
} 