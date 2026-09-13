import { NextRequest } from "next/server";
import { adminAuth } from "@/auth-admin";
import { auth } from "@/auth";
import { mergeCookie } from "@/lib/cookie-header";
import { resolveBackendPath } from "@/lib/api-mapping";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOP = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

function apiBase() {
  return process.env.API_INTERNAL_URL ?? "http://api:4000";
}

async function proxy(req: NextRequest, path: string[]) {
  const fePath = `/api/${path.join("/")}`;
  const backendPath = resolveBackendPath(fePath, req.method);
  const target = `${apiBase()}${backendPath}${req.nextUrl.search}`;
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP.has(key.toLowerCase())) headers.set(key, value);
  });

  const isAdmin = path[0] === "admin";
  if (isAdmin) {
    const session = await adminAuth();
    if (session?.sid) {
      headers.set("cookie", mergeCookie(headers.get("cookie"), `sid_admin=${session.sid}`));
    }
  } else {
    const session = await auth();
    if (session?.sid) {
      headers.set("cookie", mergeCookie(headers.get("cookie"), `sid=${session.sid}`));
    }
  }

  const init: RequestInit = { method: req.method, headers, redirect: "manual" };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = Buffer.from(await req.arrayBuffer());
  }
  const upstream = await fetch(target, init);
  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === "transfer-encoding") return;
    if (key.toLowerCase() === "set-cookie") return;
    out.set(key, value);
  });
  const cookies = upstream.headers.getSetCookie?.() ?? [];
  for (const cookie of cookies) out.append("set-cookie", cookie);
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

type Ctx = { params: Promise<{ path: string[] }> };

export const GET = (req: NextRequest, ctx: Ctx) => ctx.params.then((p) => proxy(req, p.path));
export const POST = (req: NextRequest, ctx: Ctx) => ctx.params.then((p) => proxy(req, p.path));
export const PUT = (req: NextRequest, ctx: Ctx) => ctx.params.then((p) => proxy(req, p.path));
export const PATCH = (req: NextRequest, ctx: Ctx) => ctx.params.then((p) => proxy(req, p.path));
export const DELETE = (req: NextRequest, ctx: Ctx) => ctx.params.then((p) => proxy(req, p.path));
export const HEAD = (req: NextRequest, ctx: Ctx) => ctx.params.then((p) => proxy(req, p.path));
export const OPTIONS = (req: NextRequest, ctx: Ctx) => ctx.params.then((p) => proxy(req, p.path));
