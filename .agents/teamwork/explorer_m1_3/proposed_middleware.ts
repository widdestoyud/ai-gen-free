import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { timingSafeEqual, createHash } from "node:crypto";

/**
 * Constant-time string comparison using SHA-256 pre-hashing and timingSafeEqual.
 * Pre-hashing to fixed-length 32-byte buffers eliminates RangeError exceptions on length mismatch
 * and prevents timing side-channel attacks on secret lengths and character prefixes.
 */
function safeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const hashA = createHash("sha256").update(a).digest();
  const hashB = createHash("sha256").update(b).digest();
  return timingSafeEqual(hashA, hashB);
}

export function middleware(req: NextRequest) {
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

  // Reject immediately if server admin credentials are not configured
  if (!user || !pass) {
    return new NextResponse("Autentikasi admin gagal", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="admin"' },
    });
  }

  // Constant-time evaluation of both username and password without short-circuiting
  const userValid = safeCompare(u, user);
  const passValid = safeCompare(p, pass);

  if (!userValid || !passValid) {
    return new NextResponse("Autentikasi admin gagal", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="admin"' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
