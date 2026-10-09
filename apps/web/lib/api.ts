import { formatDurationId } from "./format";
import { createDPoPProof } from "./crypto-dpop";

export type ApiErrorBody = {
  transaction_id?: string;
  error?: { code?: string; message?: string };
  retry_after_seconds?: number;
};

export type ApiFailure = {
  ok: false;
  status: number;
  code?: string;
  message: string;
  retryAfterSeconds?: number;
  transaction_id?: string;
};

export function parseApiError(body: ApiErrorBody, fallback: string): string {
  const wait =
    typeof body.retry_after_seconds === "number"
      ? ` Coba lagi dalam ${formatDurationId(body.retry_after_seconds)}.`
      : "";
  return `${body.error?.message ?? fallback}${wait}`;
}

export async function requestJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<{ ok: true; status: number; data: T } | ApiFailure> {
  try {
    const headers = new Headers(init.headers);
    if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    const method = (init.method || "GET").toUpperCase();
    const dpopProof = await createDPoPProof(method, url);
    if (dpopProof) {
      headers.set("x-dpop-proof", dpopProof);
    }
    const res = await fetch(url, { credentials: "include", ...init, headers });

    const data = (await res.json()) as T & ApiErrorBody;
    if (!res.ok) {
      if (res.status === 401 && typeof window !== "undefined" && window.location.pathname.startsWith("/app")) {
        window.location.href = "/";
      }
      return {
        ok: false,
        status: res.status,
        code: data.error?.code,
        message: parseApiError(data, "Permintaan gagal"),
        retryAfterSeconds: data.retry_after_seconds,
        transaction_id: data.transaction_id || res.headers.get("x-transaction-id") || undefined,
      };
    }
    return { ok: true, status: res.status, data };
  } catch {
    return { ok: false, status: 0, message: "Tidak bisa menghubungi server" };
  }
}
