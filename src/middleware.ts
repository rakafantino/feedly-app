import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// routes yang tidak memerlukan autentikasi
const publicRoutes = ["/", "/login", "/register"];

// routes dashboard
const dashboardRoutes = [
  "/dashboard",
  "/pos",
  "/products",
  "/reports",
  "/users",
  "/settings",
];

// routes yang memerlukan peran tertentu
const roleRoutes = new Map([
  ["/users", ["MANAGER"]],
  ["/settings", ["MANAGER"]],
]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // jika path adalah route publik, lewati
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // jika path API, lewati
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // periksa jika pengguna terotentikasi
  const token = await getToken({ req: request });

  // jika tidak terotentikasi, redirect ke halaman login
  if (!token) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // cek jika route memerlukan peran tertentu
  if (
    roleRoutes.has(pathname) &&
    !roleRoutes.get(pathname)?.includes(token.role as string)
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // cek jika route adalah dashboard route
  const isDashboardRoute = dashboardRoutes.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );

  // jika bukan dashboard route yang valid, redirect ke dashboard
  if (!isDashboardRoute && !publicRoutes.includes(pathname) && !pathname.startsWith("/api")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // jika pengguna mengakses login/register saat sudah login, redirect ke dashboard
  if (pathname === "/login" || pathname === "/register") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}; 