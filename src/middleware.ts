import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

// routes yang tidak memerlukan autentikasi
const publicRoutes = ["/", "/login", "/register", "/forgot-password", "/reset-password"];

// Routes yang diizinkan untuk setiap role
// null = dapat mengakses semua route
const allowedRoutes: Record<string, string[] | null> = {
  OWNER: null,   // Owner dapat mengakses semua
  ADMIN: null,  // Admin dapat mengakses semua
  MANAGER: null,  // Manager dapat mengakses semua
  CASHIER: [
    "/dashboard",
    "/pos",
  ]
};

export default auth((req) => {
  const { nextUrl } = req;
  const { pathname } = nextUrl;
  const session = req.auth;

  // Untuk debug
  // console.log("Middleware path:", pathname);
  // console.log("Session role:", session?.user?.role);

  // 1. Jika akses API, lewati middleware dan tangani role/permission di API handler
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // 2. Jika akses file public, lewati middleware
  if (
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 3. Jika rute publik, izinkan akses
  if (publicRoutes.includes(pathname)) {
    // Jika pengguna sudah login dan mengakses login/register, redirect ke dashboard
    if (session && (pathname === "/login" || pathname === "/register")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // 4. Jika tidak ada session, redirect ke login
  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // 5. Cek akses berbasis peran pada rute tertentu
  const role = session.user?.role?.toUpperCase() || "CASHIER"; // Default to CASHIER if role missing

  // 6. Jika user bukan ADMIN/OWNER dan tidak memiliki storeId, redirect ke halaman pilih toko
  const isSuperUser = role === "ADMIN" || role === "OWNER";
  
  if (!isSuperUser && !session.user?.storeId && !pathname.startsWith("/select-store")) {
    return NextResponse.redirect(new URL("/select-store", req.url));
  }

  // 7. Cek apakah role memiliki akses ke path ini
  const allowedPaths = allowedRoutes[role];
  
  // Jika allowedPaths adalah null (akses penuh) atau undefined (role tidak dikenal, anggap restrictive), 
  // kita perlu handle hati-hati.
  // Strategi: 
  // - Jika null: izinkan semua.
  // - Jika array: cek apakah match.
  // - Jika undefined: blokir (atau default ke CASHIER).
  
  if (allowedPaths !== null && Array.isArray(allowedPaths)) {
    // Cek apakah pathname dimulai dengan salah satu allowed routes
    const isAllowed = allowedPaths.some(route =>
      pathname === route || pathname.startsWith(route + "/")
    );

    if (!isAllowed) {
      console.log(`[Middleware] Access denied for ${role} to ${pathname}, redirecting to /dashboard`);
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // Semua kondisi lainnya diperbolehkan
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}; 