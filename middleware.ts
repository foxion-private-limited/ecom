import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const COOKIE_NAME = "foxion_session";
const SECRET_KEY = process.env.AUTH_SECRET || "foxion_super_secret_jwt_key_min_32_chars_long_foxion_2026";
const encodedKey = new TextEncoder().encode(SECRET_KEY);

const PUBLIC_FILE = /\.(.*)$/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static files, api auth, seed, and uploads
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/seed") ||
    pathname.startsWith("/uploads") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  let isAuthenticated = false;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, encodedKey);
      if (payload?.userId) {
        isAuthenticated = true;
      }
    } catch {
      isAuthenticated = false;
    }
  }

  // Handle root
  if (pathname === "/") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } else {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // If visiting login while authenticated, redirect to dashboard
  if (pathname === "/login") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Protect all internal application routes
  const protectedPrefixes = [
    "/dashboard",
    "/accounts",
    "/inventory",
    "/ecommerce",
    "/purchases",
    "/reports",
    "/bills",
    "/settings",
    "/api",
  ];

  const isProtected = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (isProtected && !isAuthenticated) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
