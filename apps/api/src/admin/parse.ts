import { JobStatus } from "@prisma/client";
import { AppError, ErrorCodes } from "@ai-gen-free/core";

export const GENERATE_COOLDOWN_KEY = "generate_cooldown_seconds";
export const GENERATE_COOLDOWN_DEFAULT = 43200;
export const GENERATE_COOLDOWN_MAX = 2_592_000;

export function parseLimitOffset(query: { limit?: unknown; offset?: unknown }): { limit: number; offset: number } {
  const limit = parseOptionalInt(query.limit, 50);
  const offset = parseOptionalInt(query.offset, 0);
  if (limit < 1 || limit > 100 || offset < 0) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "limit 1–100 dan offset ≥ 0");
  }
  return { limit, offset };
}

export function parseOptionalInt(raw: unknown, defaultValue: number): number {
  if (raw === undefined || raw === null || raw === "") return defaultValue;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
  if (!Number.isInteger(n)) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Nilai harus bilangan bulat");
  }
  return n;
}

export function parseOptionalQueryString(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Query tidak valid");
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 200) : undefined;
}

export function parseJobStatus(raw: unknown): JobStatus | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string" || !Object.values(JobStatus).includes(raw as JobStatus)) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Status job tidak valid");
  }
  return raw as JobStatus;
}

export function parseCooldownSecondsValue(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw > GENERATE_COOLDOWN_MAX) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      "Nilai cooldown harus bilangan bulat 0–2592000",
    );
  }
  return raw;
}

export function asCooldownSeconds(value: unknown): number {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= GENERATE_COOLDOWN_MAX) {
    return value;
  }
  return GENERATE_COOLDOWN_DEFAULT;
}

export function parseIdempotencyKey(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string" || value.trim().length < 8 || value.trim().length > 128) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Header Idempotency-Key wajib (8–128 karakter)");
  }
  return value.trim();
}

export function parseAdjustBody(body: { amount?: unknown; reason?: unknown }): { amount: number; reason: string } {
  const { amount, reason } = body;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1_000_000) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Amount harus bilangan bulat selain 0");
  }
  if (typeof reason !== "string") {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Alasan wajib diisi (3–500 karakter)");
  }
  const trimmed = reason.trim();
  if (trimmed.length < 3 || trimmed.length > 500) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, "Alasan wajib diisi (3–500 karakter)");
  }
  return { amount, reason: trimmed };
}
