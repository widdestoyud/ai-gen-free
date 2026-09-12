export type FetchedBytes = {
  body: Uint8Array;
  contentType: string;
};

const DOWNLOAD_TIMEOUT_MS = 45_000;
const MAX_REDIRECTS = 8;

export async function fetchOutputBytes(url: string, fetchImpl: typeof fetch = fetch): Promise<FetchedBytes> {
  if (url.startsWith("data:")) {
    return decodeDataUrl(url);
  }
  const res = await getFollowingRedirects(url, fetchImpl);
  if (!res.ok) {
    throw new Error(`output download HTTP ${res.status} ${url.split("?")[0]}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  return interpretBody(buf, res.headers.get("content-type"));
}

async function getFollowingRedirects(url: string, fetchImpl: typeof fetch): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetchImpl(current, {
      method: "GET",
      redirect: "manual",
      headers: downloadHeaders(),
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) {
        throw new Error(`output download HTTP ${res.status} without Location ${current.split("?")[0]}`);
      }
      current = new URL(loc, current).href;
      continue;
    }
    return res;
  }
  throw new Error("output download too many redirects");
}

function downloadHeaders(): Headers {
  const headers = new Headers();
  headers.set("accept", "image/*,application/octet-stream;q=0.9,*/*;q=0.8");
  headers.set("user-agent", "ai-gen-free-worker/1.0");
  return headers;
}

function interpretBody(buf: Uint8Array, headerType: string | null): FetchedBytes {
  const sniffed = sniffContentType(buf);
  if (sniffed.startsWith("image/")) {
    return { body: buf, contentType: sniffed };
  }
  const contentType = headerType?.split(";")[0]?.trim() || sniffed;
  if (contentType.startsWith("image/") || contentType === "application/octet-stream") {
    return { body: buf, contentType };
  }
  if (contentType.includes("json") || contentType.includes("html") || contentType.includes("text/")) {
    const preview = new TextDecoder().decode(buf.slice(0, 180)).replace(/\s+/g, " ");
    throw new Error(`output download bukan gambar (${contentType}): ${preview}`);
  }
  return { body: buf, contentType };
}

/** GET hasil Siray: Bearer hanya untuk path API `/v1/`. URL `/redirect/` publik; Bearer bisa di-drop WAF/CDN. */
export function fetchWithSirayAuth(token: string, fetchImpl: typeof fetch = fetch): typeof fetch {
  const trimmed = token.trim();
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    try {
      if (trimmed && shouldAttachSirayAuth(String(input))) {
        headers.set("authorization", `Bearer ${trimmed}`);
      }
    } catch {
      // URL tidak valid: biarkan fetch asli yang melempar.
    }
    return fetchImpl(input, { ...init, headers, redirect: init?.redirect ?? "follow" });
  };
}

export function shouldAttachSirayAuth(url: string): boolean {
  const parsed = new URL(url);
  if (parsed.hostname !== "api.siray.ai" && !parsed.hostname.endsWith(".siray.ai")) return false;
  return parsed.pathname.startsWith("/v1/");
}

export function extensionFor(contentType: string): string {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "png";
}

function decodeDataUrl(url: string): FetchedBytes {
  const match = url.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) throw new Error("invalid data URL");
  const contentType = match[1] || "application/octet-stream";
  const base64 = Boolean(match[2]);
  const data = match[3] ?? "";
  const body = base64 ? Buffer.from(data, "base64") : Buffer.from(decodeURIComponent(data), "utf8");
  return { body: new Uint8Array(body), contentType };
}

function sniffContentType(body: Uint8Array): string {
  if (body.length >= 8 && body[0] === 0x89 && body[1] === 0x50 && body[2] === 0x4e && body[3] === 0x47) {
    return "image/png";
  }
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    body.length >= 12 &&
    body[0] === 0x52 &&
    body[1] === 0x49 &&
    body[2] === 0x46 &&
    body[3] === 0x46 &&
    body[8] === 0x57 &&
    body[9] === 0x45 &&
    body[10] === 0x42 &&
    body[11] === 0x50
  ) {
    return "image/webp";
  }
  return "application/octet-stream";
}
