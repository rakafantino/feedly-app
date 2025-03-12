import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// routes yang tidak memerlukan autentikasi
const publicRoutes = ["/", "/login", "/register", "/forgot-password", "/reset-password"];

// routes yang memerlukan peran tertentu
const roleBasedRoutes = {
  MANAGER: ["/users", "/settings"],
  CASHIER: []
};

export default auth((req) => {
  const { nextUrl } = req;
  const { pathname } = nextUrl;
  const session = req.auth;
  
  // Untuk debug
  console.log("Middleware path:", pathname);
  console.log("Session:", session ? "Exists" : "None");
  
  // 1. Jika akses API, lewati middleware
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
  const role = session.user?.role?.toUpperCase() as "MANAGER" | "CASHIER";
  
  if (role && roleBasedRoutes[role]) {
    // Jika terdapat path yang memerlukan peran tertentu
    const restrictedPaths = Object.entries(roleBasedRoutes)
      .filter(([routeRole]) => routeRole !== role)
      .flatMap(([, paths]) => paths);

    // Cek jika user mencoba mengakses rute yang dilarang
    const isRestricted = restrictedPaths.some(route => 
      pathname.startsWith(route)
    );
    
    if (isRestricted) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // Semua kondisi lainnya diperbolehkan
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}; 