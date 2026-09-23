export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";
export type LogService = "api" | "worker" | "web" | "siray" | "storage" | "payment";

export type StructuredLogEvent = {
  timestamp?: string | Date;
  level: LogLevel;
  service: LogService;
  event: string;
  message: string;
  transactionId?: string | null;
  userId?: string | null;
  jobId?: string | null;
  durationMs?: number | null;
  httpMethod?: string | null;
  httpPath?: string | null;
  httpStatus?: number | null;
  error?: Record<string, unknown> | null;
  context?: Record<string, unknown> | null;
};

const SENSITIVE_KEYS = new Set([
  "password",
  "newpassword",
  "oldpassword",
  "passwordhash",
  "token",
  "tokenhash",
  "otp",
  "otpcode",
  "authorization",
  "cookie",
  "sid",
  "sid_admin",
  "secret",
  "apikey",
  "siray_api_token",
  "storage_secret_key",
  "session_secret",
  "midtrans_server_key",
]);

export function redactSensitiveData(obj: unknown): unknown {
  if (typeof obj === "string") {
    if (obj.startsWith("data:image/") && obj.includes(";base64,")) {
      const mime = obj.slice(5, obj.indexOf(";"));
      return `[redacted_base64 length=${obj.length} mime=${mime}]`;
    }
    if (obj.length > 2000 && /^[A-Za-z0-9+/=]+$/.test(obj.slice(0, 100))) {
      return `[redacted_base64 length=${obj.length}]`;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData);
  }

  if (obj !== null && typeof obj === "object") {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      const lower = k.toLowerCase().replace(/[-_]/g, "");
      if (SENSITIVE_KEYS.has(lower)) {
        res[k] = "[REDACTED]";
      } else {
        res[k] = redactSensitiveData(v);
      }
    }
    return res;
  }

  return obj;
}

export function formatStructuredLog(entry: StructuredLogEvent): string {
  const ts = entry.timestamp instanceof Date
    ? entry.timestamp.toISOString()
    : entry.timestamp || new Date().toISOString();

  const payload = {
    timestamp: ts,
    level: entry.level,
    service: entry.service,
    event: entry.event,
    message: entry.message,
    ...(entry.transactionId ? { transaction_id: entry.transactionId } : {}),
    ...(entry.userId ? { user_id: entry.userId } : {}),
    ...(entry.jobId ? { job_id: entry.jobId } : {}),
    ...(typeof entry.durationMs === "number" ? { duration_ms: entry.durationMs } : {}),
    ...(entry.httpMethod || entry.httpPath || entry.httpStatus
      ? {
          http: {
            method: entry.httpMethod ?? null,
            path: entry.httpPath ?? null,
            status_code: entry.httpStatus ?? null,
          },
        }
      : {}),
    ...(entry.error ? { error: redactSensitiveData(entry.error) } : {}),
    ...(entry.context ? { context: redactSensitiveData(entry.context) } : {}),
  };

  return JSON.stringify(payload);
}
