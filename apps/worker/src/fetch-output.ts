export type FetchedBytes = {
  body: Uint8Array;
  contentType: string;
};

export async function fetchOutputBytes(url: string, fetchImpl: typeof fetch = fetch): Promise<FetchedBytes> {
  if (url.startsWith("data:")) {
    return decodeDataUrl(url);
  }
  const res = await fetchImpl(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`output download HTTP ${res.status}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const headerType = res.headers.get("content-type")?.split(";")[0]?.trim();
  return { body: buf, contentType: headerType || sniffContentType(buf) };
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
  return "application/octet-stream";
}
