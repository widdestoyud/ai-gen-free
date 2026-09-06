import type { IncomingHttpHeaders } from "node:http";
import { AppError } from "@ai-gen-free/core";
import { AuthError } from "./auth/service.js";

export function requestIp(req: { ip: string; headers: IncomingHttpHeaders }): string {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof raw === "string" && raw.length > 0) {
    return raw.split(",")[0]!.trim();
  }
  return req.ip;
}

export function sendError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: unknown,
  req?: { id?: string },
) {
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
