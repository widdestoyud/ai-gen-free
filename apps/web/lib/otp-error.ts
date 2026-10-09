export type AuthActionResult =
  | { ok: true }
  | { ok: false; message: string; code?: string; transaction_id?: string };

function isInternalErrorMessage(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("prisma") ||
    lower.includes("fatal:") ||
    lower.includes("ecircuitbreaker") ||
    lower.includes("invocation in") ||
    lower.includes("error querying the database") ||
    lower.includes("select ") ||
    lower.includes("insert into") ||
    lower.includes("postgres") ||
    lower.includes("connection pool") ||
    lower.includes("stack trace") ||
    lower.includes("econnrefused")
  );
}

export function parseAuthBridgeError(err: unknown): {
  message: string;
  code?: string;
  transaction_id?: string;
  requiresOtp?: boolean;
} {
  if (typeof err === "string" && err.includes("||")) {
    const [code, message, txid, flag] = err.split("||");
    const isInternal = code?.startsWith("E") || isInternalErrorMessage(message ?? "");
    return {
      code: isInternal ? "E001" : code || "A002",
      message: isInternal
        ? "Terjadi gangguan sementara pada sistem. Silakan coba beberapa saat lagi."
        : message || "Kode salah",
      transaction_id: txid || undefined,
      requiresOtp: flag === "OTP_REQUIRED",
    };
  }

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
    const isInternal = code?.startsWith("E") || isInternalErrorMessage(message ?? "");
    return {
      code: isInternal ? "E001" : code || "A002",
      message: isInternal
        ? "Terjadi gangguan sementara pada sistem. Silakan coba beberapa saat lagi."
        : message || "Kode salah",
      transaction_id: txid || undefined,
      requiresOtp: flag === "OTP_REQUIRED",
    };
  }

  const raw = err instanceof Error ? `${err.name} ${err.message}` : String(err ?? "");
  if (isInternalErrorMessage(raw)) {
    return {
      code: "E001",
      message: "Terjadi gangguan sementara pada sistem. Silakan coba beberapa saat lagi.",
    };
  }
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
