import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
  if (!user || !pass || u !== user || p !== pass) {
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
