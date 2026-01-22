import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

// routes yang tidak memerlukan autentikasi
const publicRoutes = ["/", "/login", "/register", "/forgot-password", "/reset-password"];

// Routes yang diizinkan untuk setiap role
// null = dapat mengakses semua route
const allowedRoutes: Record<string, string[] | null> = {
  ADMIN: null,  // Admin dapat mengakses semua
  MANAGER: null,  // Manager dapat mengakses semua
  CASHIER: [
    "/dashboard",
    "/pos",
    "/select-store"
  ]
};

export default auth((req) => {
  const { nextUrl } = req;
  const { pathname } = nextUrl;
  const session = req.auth;

  // Untuk debug
  console.log("Middleware path:", pathname);
  console.log("Session:", session ? "Exists" : "None");

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
  const role = session.user?.role?.toUpperCase() as "ADMIN" | "MANAGER" | "CASHIER";

  // 6. Jika user bukan ADMIN dan tidak memiliki storeId, redirect ke halaman pilih toko
  // Kecuali jika mereka sedang mengakses halaman pilih toko
  if (role !== "ADMIN" && !session.user?.storeId && !pathname.startsWith("/select-store")) {
    return NextResponse.redirect(new URL("/select-store", req.url));
  }

  // 7. Cek apakah role memiliki akses ke path ini
  if (role && allowedRoutes[role] !== null) {
    const allowed = allowedRoutes[role] as string[];

    // Cek apakah pathname dimulai dengan salah satu allowed routes
    const isAllowed = allowed.some(route =>
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