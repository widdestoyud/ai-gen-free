import { AppError } from "@ai-gen-free/core";
import { AuthError } from "./auth/service.js";

export function sendError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: unknown,
) {
  if (err instanceof AppError) {
    return reply.status(err.status).send({
      error: { code: err.code, message: err.message },
      ...err.extra,
    });
  }
  if (err instanceof AuthError) {
    return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
  }
  throw err;
}
