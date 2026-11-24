import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // 1. Cross-domain OAuth / API session token bridge
  const tokenParam = searchParams.get("session_token");
  if (tokenParam) {
    const cleanUrl = new URL(request.url);
    cleanUrl.searchParams.delete("session_token");
    const response = NextResponse.redirect(cleanUrl);
    response.cookies.set("hp_session", tokenParam, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      maxAge: 30 * 24 * 3600,
    });
    return response;
  }

  // 2. Protect all /dashboard routes, /connect, and /insights from unauthenticated access
  if (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/connect" ||
    pathname.startsWith("/connect/") ||
    pathname === "/insights" ||
    pathname.startsWith("/insights/")
  ) {
    const sessionCookie = request.cookies.get("hp_session");

    if (!sessionCookie || !sessionCookie.value) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname === "/insights" ? "/dashboard/insights" : pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/connect",
    "/connect/:path*",
    "/insights",
    "/insights/:path*",
  ],
};

