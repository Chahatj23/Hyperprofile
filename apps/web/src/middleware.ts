import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect all /dashboard routes, /connect, and /insights from unauthenticated access
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/connect") || pathname.startsWith("/insights")) {
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
    "/dashboard/:path*",
    "/connect",
    "/insights",
  ],
};

