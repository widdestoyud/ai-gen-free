import { NextRequest, NextResponse } from "next/server";
import { proxyFastify } from "@/lib/bff-proxy";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.sid) {
    return NextResponse.json({ ok: false, user: null }, { status: 200 });
  }
  return proxyFastify(req, "/api/user/profile", "user");
}

export function PATCH(req: NextRequest) {
  return proxyFastify(req, "/api/user/profile", "user");
}

export function PUT(req: NextRequest) {
  return proxyFastify(req, "/api/user/profile", "user");
}
