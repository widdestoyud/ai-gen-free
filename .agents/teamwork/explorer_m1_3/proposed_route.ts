import { NextRequest } from "next/server";
import { adminAuth } from "@/auth-admin";
import { auth } from "@/auth";
import { mergeCookie, sanitizeCookie } from "@/lib/cookie-header";
import { resolveBackendPath } from "@/lib/api-mapping";
import { adminBasicHeaders } from "@/lib/server-api";

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

  // Endpoint /auth/google adalah internal server-to-server saja
  if (backendPath === "/auth/google" || fePath === "/api/auth/google") {
    return new Response(JSON.stringify({ error: { code: "A007", message: "Forbidden" } }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  const target = `${apiBase()}${backendPath}${req.nextUrl.search}`;
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP.has(key.toLowerCase())) headers.set(key, value);
  });

  // Sanitize incoming cookies: strip any untrusted client-supplied sid or sid_admin
  const rawCookie = headers.get("cookie");
  if (rawCookie) {
    const sanitized = sanitizeCookie(rawCookie);
    if (sanitized) {
      headers.set("cookie", sanitized);
    } else {
      headers.delete("cookie");
    }
  }

  const isAdmin = path[0] === "admin";
  if (isAdmin) {
    const session = await adminAuth();
    // Security: Only forward session cookie and attach admin Basic Auth credentials
    // if NextAuth verified an active, authenticated admin session.
    if (session?.sid) {
      headers.set("cookie", mergeCookie(headers.get("cookie"), `sid_admin=${session.sid}`));
      for (const [key, value] of Object.entries(adminBasicHeaders())) {
        if (!headers.has(key)) headers.set(key, value);
      }
    }
  } else {
    const session = await auth();
    // Security: Only forward customer session cookie if authenticated by NextAuth.
    if (session?.sid) {
      headers.set("cookie", mergeCookie(headers.get("cookie"), `sid=${session.sid}`));
    }
  }

  const isSSE = fePath.endsWith("/events") || backendPath.endsWith("/events");
  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
    cache: "no-store",
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      init.body = Buffer.from(await req.arrayBuffer());
    } catch (err) {
      console.error("[BFF Proxy Body Read Error]:", err);
      return new Response(
        JSON.stringify({
          error: {
            code: "E001",
            message: "Gagal membaca body request.",
          },
        }),
        {
          status: 400,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        },
      );
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (error) {
    console.error(`[BFF Proxy Error] Upstream connection failure to ${target}:`, error);
    return new Response(
      JSON.stringify({
        error: {
          code: "E001",
          message: "Gagal terhubung ke layanan backend.",
        },
      }),
      {
        status: 502,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      },
    );
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() === "transfer-encoding") return;
    if (key.toLowerCase() === "set-cookie") return;
    out.set(key, value);
  });
  const cookies = upstream.headers.getSetCookie?.() ?? [];
  for (const cookie of cookies) out.append("set-cookie", cookie);

  const lowerFePath = fePath.toLowerCase();
  if (isSSE) {
    out.set("content-type", "text/event-stream; charset=utf-8");
    out.set("cache-control", "no-cache, no-transform");
    out.set("connection", "keep-alive");
    out.set("x-accel-buffering", "no");
  } else if (
    lowerFePath.includes("wallet") ||
    lowerFePath.includes("coin") ||
    lowerFePath.includes("billing") ||
    lowerFePath.includes("ledger") ||
    lowerFePath.includes("invoice")
  ) {
    out.set("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    out.set("pragma", "no-cache");
    out.set("expires", "0");
    out.set("surrogate-control", "no-store");
  }

  return new Response(upstream.body, { status: upstream.status, headers: out });
}

type Ctx = { params: Promise<{ path: string[] }> };

async function handleProxy(req: NextRequest, ctx: Ctx) {
  try {
    const { path } = await ctx.params;
    return await proxy(req, path);
  } catch (error) {
    console.error("[BFF Proxy Handler Exception]:", error);
    return new Response(
      JSON.stringify({
        error: {
          code: "E001",
          message: "Gagal terhubung ke layanan backend.",
        },
      }),
      {
        status: 502,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      },
    );
  }
}

export const GET = (req: NextRequest, ctx: Ctx) => handleProxy(req, ctx);
export const POST = (req: NextRequest, ctx: Ctx) => handleProxy(req, ctx);
export const PUT = (req: NextRequest, ctx: Ctx) => handleProxy(req, ctx);
export const PATCH = (req: NextRequest, ctx: Ctx) => handleProxy(req, ctx);
export const DELETE = (req: NextRequest, ctx: Ctx) => handleProxy(req, ctx);
export const HEAD = (req: NextRequest, ctx: Ctx) => handleProxy(req, ctx);
export const OPTIONS = (req: NextRequest, ctx: Ctx) => handleProxy(req, ctx);
