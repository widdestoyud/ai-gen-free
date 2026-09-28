import type { IncomingHttpHeaders } from "node:http";

export interface ClientInfo {
  ip: string;
  provider?: string | null;
  os?: string | null;
  browser?: string | null;
  deviceType?: "desktop" | "mobile" | "tablet" | "bot" | string | null;
  country?: string | null;
  city?: string | null;
  region?: string | null;
}

export function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  const clean = ip.replace(/^::ffff:/, "").trim();
  if (
    clean === "127.0.0.1" ||
    clean === "::1" ||
    clean === "localhost" ||
    clean.startsWith("10.") ||
    clean.startsWith("192.168.")
  ) {
    return true;
  }
  if (clean.startsWith("172.")) {
    const parts = clean.split(".");
    const second = Number(parts[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

export function parseUserAgent(uaString?: string | null): {
  os: string;
  browser: string;
  deviceType: "desktop" | "mobile" | "tablet" | "bot";
} {
  if (!uaString || typeof uaString !== "string") {
    return { os: "Unknown OS", browser: "Unknown Browser", deviceType: "desktop" };
  }

  const ua = uaString.trim();

  // 1. Detect Device Type
  let deviceType: "desktop" | "mobile" | "tablet" | "bot" = "desktop";
  if (/bot|crawler|spider|crawling|curl|wget|postman/i.test(ua)) {
    deviceType = "bot";
  } else if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
    deviceType = "tablet";
  } else if (/mobile|iphone|ipod|android.*mobile|blackberry|iemobile|opera mini/i.test(ua)) {
    deviceType = "mobile";
  }

  // 2. Detect Operating System
  let os = "Unknown OS";
  if (/windows nt 10\.0/i.test(ua)) {
    os = "Windows 10/11";
  } else if (/windows nt 6\.3/i.test(ua)) {
    os = "Windows 8.1";
  } else if (/windows nt 6\.2/i.test(ua)) {
    os = "Windows 8";
  } else if (/windows nt 6\.1/i.test(ua)) {
    os = "Windows 7";
  } else if (/windows nt/i.test(ua)) {
    os = "Windows";
  } else if (/iphone os ([0-9_]+)/i.test(ua)) {
    const match = ua.match(/iphone os ([0-9_]+)/i);
    os = match ? `iOS ${match[1]!.replace(/_/g, ".")}` : "iOS";
  } else if (/ipad.*os ([0-9_]+)/i.test(ua)) {
    const match = ua.match(/os ([0-9_]+)/i);
    os = match ? `iPadOS ${match[1]!.replace(/_/g, ".")}` : "iPadOS";
  } else if (/macintosh|mac os x ([0-9_]+)/i.test(ua)) {
    const match = ua.match(/mac os x ([0-9_]+)/i);
    os = match ? `macOS ${match[1]!.replace(/_/g, ".")}` : "macOS";
  } else if (/android ([0-9.]+)/i.test(ua)) {
    const match = ua.match(/android ([0-9.]+)/i);
    os = match ? `Android ${match[1]}` : "Android";
  } else if (/cros/i.test(ua)) {
    os = "Chrome OS";
  } else if (/ubuntu/i.test(ua)) {
    os = "Ubuntu Linux";
  } else if (/linux/i.test(ua)) {
    os = "Linux";
  }

  // 3. Detect Browser
  let browser = "Unknown Browser";
  if (/edg\/([0-9.]+)/i.test(ua)) {
    const match = ua.match(/edg\/([0-9.]+)/i);
    browser = match ? `Edge ${match[1]!.split(".")[0]}` : "Edge";
  } else if (/opr\/([0-9.]+)|opera/i.test(ua)) {
    const match = ua.match(/opr\/([0-9.]+)/i);
    browser = match ? `Opera ${match[1]!.split(".")[0]}` : "Opera";
  } else if (/samsungbrowser\/([0-9.]+)/i.test(ua)) {
    const match = ua.match(/samsungbrowser\/([0-9.]+)/i);
    browser = match ? `Samsung Internet ${match[1]!.split(".")[0]}` : "Samsung Internet";
  } else if (/chrome\/([0-9.]+)/i.test(ua) && !/edg/i.test(ua) && !/opr/i.test(ua)) {
    const match = ua.match(/chrome\/([0-9.]+)/i);
    browser = match ? `Chrome ${match[1]!.split(".")[0]}` : "Chrome";
  } else if (/firefox\/([0-9.]+)/i.test(ua)) {
    const match = ua.match(/firefox\/([0-9.]+)/i);
    browser = match ? `Firefox ${match[1]!.split(".")[0]}` : "Firefox";
  } else if (/version\/([0-9.]+).*safari/i.test(ua)) {
    const match = ua.match(/version\/([0-9.]+)/i);
    browser = match ? `Safari ${match[1]!.split(".")[0]}` : "Safari";
  } else if (/curl\/([0-9.]+)/i.test(ua)) {
    browser = "cURL";
  } else if (/postman/i.test(ua)) {
    browser = "Postman";
  }

  return { os, browser, deviceType };
}

export function extractClientInfo(req: {
  ip?: string;
  headers?: IncomingHttpHeaders;
}): ClientInfo {
  const headers = req.headers ?? {};

  // 1. Extract IP
  let ip = "";
  const cfIp = headers["cf-connecting-ip"];
  if (typeof cfIp === "string" && cfIp.trim()) {
    ip = cfIp.trim();
  } else {
    const forwarded = headers["x-forwarded-for"];
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    if (typeof raw === "string" && raw.trim()) {
      ip = raw.split(",")[0]!.trim();
    } else {
      const realIp = headers["x-real-ip"];
      if (typeof realIp === "string" && realIp.trim()) {
        ip = realIp.trim();
      } else if (typeof req.ip === "string" && req.ip.trim()) {
        ip = req.ip.trim();
      } else {
        ip = "127.0.0.1";
      }
    }
  }

  // Clean IPv6 mapped IPv4 address
  ip = ip.replace(/^::ffff:/, "");

  // 2. Parse User-Agent
  const rawUa = headers["user-agent"];
  const uaString = Array.isArray(rawUa) ? rawUa[0] : rawUa;
  const { os, browser, deviceType } = parseUserAgent(uaString);

  // 3. Location & Provider extraction from Cloudflare / Proxy headers
  let country: string | null = null;
  let city: string | null = null;
  let region: string | null = null;
  let provider: string | null = null;

  const cfCountry = headers["cf-ipcountry"];
  if (typeof cfCountry === "string" && cfCountry.trim() && cfCountry !== "XX") {
    country = cfCountry.trim().toUpperCase();
  }

  const cfCity = headers["cf-ipcity"];
  if (typeof cfCity === "string" && cfCity.trim()) {
    city = cfCity.trim();
  }

  const cfRegion = headers["cf-region"] || headers["cf-region-code"];
  if (typeof cfRegion === "string" && cfRegion.trim()) {
    region = cfRegion.trim();
  }

  const cfAsOrg = headers["cf-asorganization"] || headers["cf-asn"];
  if (typeof cfAsOrg === "string" && cfAsOrg.trim()) {
    provider = cfAsOrg.trim();
  }

  // Fallback for local / private environment
  if (isPrivateIp(ip)) {
    country = country ?? "ID (Lokal)";
    city = city ?? "Localhost";
    provider = provider ?? "Local Network / Development";
  }

  return {
    ip,
    provider,
    os,
    browser,
    deviceType,
    country,
    city,
    region,
  };
}
