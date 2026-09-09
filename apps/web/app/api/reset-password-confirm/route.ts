import { NextRequest } from "next/server";
import { proxyFastify } from "@/lib/bff-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(req: NextRequest) {
  return proxyFastify(req, "/api/auth/password-reset-confirm", "public");
}
