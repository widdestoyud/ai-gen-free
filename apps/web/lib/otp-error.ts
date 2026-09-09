export type AuthActionResult =
  | { ok: true }
  | { ok: false; message: string; code?: string; transaction_id?: string };

export function parseAuthBridgeError(err: unknown): {
  message: string;
  code?: string;
  transaction_id?: string;
  requiresOtp?: boolean;
} {
  const anyErr = err as Record<string, unknown> | null;
  const cause = anyErr?.cause as Record<string, unknown> | null;
  const inner = (cause?.err as Record<string, unknown> | null) || cause || anyErr;

  const rawCode =
    typeof inner?.code === "string"
      ? inner.code
      : typeof anyErr?.code === "string"
        ? anyErr.code
        : "";

  if (rawCode.includes("||")) {
    const [code, message, txid, flag] = rawCode.split("||");
    return {
      code: code || "A002",
      message: message || "Kode salah",
      transaction_id: txid || undefined,
      requiresOtp: flag === "OTP_REQUIRED",
    };
  }

  const raw = err instanceof Error ? `${err.name} ${err.message}` : String(err ?? "");
  if (/kedaluwarsa/i.test(raw)) {
    return { code: "A003", message: "Kode OTP kedaluwarsa" };
  }
  if (/terkunci/i.test(raw)) {
    return { code: "A004", message: "Kode OTP terkunci" };
  }
  return { code: "A002", message: "Kode salah" };
}

export function parseOtpError(err: unknown): { message: string; code?: string; transaction_id?: string } {
  const parsed = parseAuthBridgeError(err);
  return { message: parsed.message, code: parsed.code, transaction_id: parsed.transaction_id };
}
