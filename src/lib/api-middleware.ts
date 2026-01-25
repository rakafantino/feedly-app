import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Middleware untuk melindungi API routes
 * Memastikan pengguna terautentikasi dan memiliki role yang sesuai
 * @param handler Handler untuk route API
 * @param options Opsi konfigurasi middleware
 * @returns Handler yang sudah dilindungi middleware
 */
export function withAuth(
  handler: (req: NextRequest, session: any, storeId: string | null, ...args: any[]) => Promise<NextResponse>,
  options: {
    requiredRoles?: string[];
    requireStore?: boolean;
  } = {}
) {
  return async (req: NextRequest, ...args: any[]) => {
    // Periksa autentikasi
    const session = await auth();

    // Jika tidak terautentikasi
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Periksa peran pengguna jika diperlukan
    if (options.requiredRoles && options.requiredRoles.length > 0) {
      const userRole = session.user.role?.toLowerCase();
      if (!userRole || !options.requiredRoles.includes(userRole)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Dapatkan storeId dari session terlebih dahulu
    let storeId = session.user.storeId || null;
    
    // Jika session tidak memiliki storeId, coba ambil dari cookie
    try {
      const selectedStoreId = req.cookies.get("selectedStoreId")?.value;
      // Hindari cookie menimpa storeId dari session (yang bisa stale setelah logout/login)
      if (!storeId && selectedStoreId) {
        storeId = selectedStoreId;
      }
    } catch (error) {
      console.error("Error accessing cookies:", error);
    }

    // Jika require store tetapi tidak ada storeId
    if (options.requireStore && !storeId) {
      return NextResponse.json(
        { error: "Store selection required" },
        { status: 400 }
      );
    }

    // Teruskan ke handler dengan session dan storeId serta argument tambahan (seperti params)
    return handler(req, session, storeId, ...args);
  };
}

/**
 * Helper untuk membatasi akses API berdasarkan storeId
 * Memastikan data yang diminta/diubah adalah milik toko yang sesuai
 * @param storeId ID toko dari permintaan
 * @param userStoreId ID toko dari pengguna/session
 * @param userRole Peran pengguna
 * @returns Apakah pengguna memiliki akses ke toko
 */
export function hasStoreAccess(
  storeId: string | null | undefined,
  userStoreId: string | null | undefined,
  userRole: string
): boolean {
  // Admin memiliki akses ke semua toko
  if (userRole.toLowerCase() === "admin") {
    return true;
  }

  // Jika storeId tidak ada, tetapi user memiliki storeId, izinkan akses
  if (!storeId && userStoreId) {
    return true;
  }

  // Jika storeId ada, pastikan sama dengan userStoreId
  return storeId === userStoreId;
}