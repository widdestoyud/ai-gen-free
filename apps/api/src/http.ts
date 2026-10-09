import type { IncomingHttpHeaders } from "node:http";
import { AppError } from "@ai-gen-free/core";
import { AuthError } from "./auth/service.js";

/**
 * Ekstraksi IP klien secara terpadu dan aman:
 * 1. Prioritaskan header Cloudflare (cf-connecting-ip) jika ada
 * 2. Ambil hop terluar (kiri) dari x-forwarded-for
 * 3. Fallback ke x-real-ip
 * 4. Fallback ke req.ip bawaan Fastify (didukung trustProxy: true)
 * 5. Normalisasi IPv6 mapped IPv4 (menghapus ::ffff:)
 */
export function requestIp(req: {
  ip?: string;
  headers?: IncomingHttpHeaders | Record<string, unknown>;
}): string {
  const headers = (req.headers ?? {}) as Record<string, unknown>;

  // 1. Cloudflare header
  const cfConnecting = headers["cf-connecting-ip"];
  if (typeof cfConnecting === "string" && cfConnecting.trim().length > 0) {
    return cfConnecting.trim().replace(/^::ffff:/, "");
  }

  // 2. X-Forwarded-For (client is leftmost IP)
  const forwarded = headers["x-forwarded-for"];
  const rawForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof rawForwarded === "string" && rawForwarded.trim().length > 0) {
    const clientHop = rawForwarded.split(",")[0]?.trim();
    if (clientHop && clientHop.length > 0) {
      return clientHop.replace(/^::ffff:/, "");
    }
  }

  // 3. X-Real-IP
  const realIp = headers["x-real-ip"];
  const rawRealIp = Array.isArray(realIp) ? realIp[0] : realIp;
  if (typeof rawRealIp === "string" && rawRealIp.trim().length > 0) {
    return rawRealIp.trim().replace(/^::ffff:/, "");
  }

  // 4. Fastify resolved IP
  if (typeof req.ip === "string" && req.ip.trim().length > 0) {
    return req.ip.trim().replace(/^::ffff:/, "");
  }

  return "127.0.0.1";
}

export function sendError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown }; header: (k: string, v: string) => unknown },
  err: unknown,
  req?: { id?: string },
) {
  reply.header("cache-control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  reply.header("pragma", "no-cache");
  reply.header("expires", "0");
  const txid = req?.id;
  if (err instanceof AppError) {
    return reply.status(err.status).send({
      ...(txid ? { transaction_id: txid } : {}),
      error: { code: err.code, message: err.message },
      ...err.extra,
    });
  }
  if (err instanceof AuthError) {
    return reply.status(err.status).send({
      ...(txid ? { transaction_id: txid } : {}),
      error: { code: err.code, message: err.message },
    });
  }
  throw err;
}
