import { NextRequest } from "next/server";
import { proxyFastify } from "@/lib/bff-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(req: NextRequest) {
  return proxyFastify(req, "/api/user/profile", "user");
}

export function PATCH(req: NextRequest) {
  return proxyFastify(req, "/api/user/profile", "user");
}

export function PUT(req: NextRequest) {
  return proxyFastify(req, "/api/user/profile", "user");
}
