import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { detectLocale } from "./lib/i18n/detector";

/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 * Uses an XOR accumulator across all characters without early return.
 */
function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  let mismatch = a.length === b.length ? 0 : 1;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const charA = i < a.length ? a.charCodeAt(i) : 0;
    const charB = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= charA ^ charB;
  }
  return mismatch === 0;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Admin & Admin API Route Gate (Strict Basic Auth)
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const user = process.env.ADMIN_BASIC_USER ?? "";
    const pass = process.env.ADMIN_BASIC_PASSWORD ?? "";
    const header = req.headers.get("authorization");

    if (!header?.startsWith("Basic ")) {
      return new NextResponse("Autentikasi admin diperlukan", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="admin"' },
      });
    }

    let decoded = "";
    try {
      decoded = atob(header.slice(6));
    } catch {
      decoded = "";
    }

    const i = decoded.indexOf(":");
    const u = i >= 0 ? decoded.slice(0, i) : "";
    const p = i >= 0 ? decoded.slice(i + 1) : "";

    if (!user || !pass || !safeCompare(u, user) || !safeCompare(p, pass)) {
      return new NextResponse("Autentikasi admin gagal", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="admin"' },
      });
    }

    return NextResponse.next();
  }

  // 2. Client & Public Routes: I18n Locale Resolution & Header Forwarding
  const locale = detectLocale(req.cookies, req.headers);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-locale", locale);

  const res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Persist NEXT_LOCALE cookie if not yet set
  if (!req.cookies.get("NEXT_LOCALE")) {
    res.cookies.set("NEXT_LOCALE", locale, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
    });
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
