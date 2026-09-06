import { formatDurationId } from "./format";

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

export async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
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
    const res = await fetch(url, { credentials: "include", ...init, headers });
    const data = (await res.json()) as T & ApiErrorBody;
    if (!res.ok) {
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
