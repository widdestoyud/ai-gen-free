import { NextRequest } from "next/server";
import { adminAuth } from "@/auth-admin";
import { auth } from "@/auth";
import { mergeCookie } from "./cookie-header";
import { adminBasicHeaders, apiBase } from "./server-api";

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

export async function proxyFastify(
  req: NextRequest,
  fastifyPath: string,
  kind: "user" | "admin" | "public" = "public",
) {
  const target = `${apiBase()}${fastifyPath}`;
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP.has(key.toLowerCase())) headers.set(key, value);
  });

  const forwarded = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip");
  if (forwarded) headers.set("x-forwarded-for", forwarded);

  if (kind === "admin") {
    const session = await adminAuth();
    if (session?.sid) {
      headers.set("cookie", mergeCookie(headers.get("cookie"), `sid_admin=${session.sid}`));
    }
    for (const [key, value] of Object.entries(adminBasicHeaders())) {
      headers.set(key, value);
    }
  } else if (kind === "user") {
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
