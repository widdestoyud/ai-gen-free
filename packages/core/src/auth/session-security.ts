/**
 * Session Security & Anti-Hijacking Protection Layer
 * 
 * Melindungi sesi dari pencurian/pembajakan (Session Hijacking) ketika token/cookie
 * diekspor atau digunakan di Postman, Burp Suite, cURL, maupun browser/perangkat lain.
 */

export interface SessionBindingContext {
  ip?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
  strictIp?: boolean;
}

export interface SessionVerificationResult {
  valid: boolean;
  reason?: "USER_AGENT_MISMATCH" | "IP_MISMATCH" | "SUSPICIOUS_CLIENT";
}

/**
 * Mendeteksi apakah User-Agent berasal dari HTTP testing client / tool otomatisasi.
 */
export function isAutomatedToolUserAgent(ua?: string | null): boolean {
  if (!ua || typeof ua !== "string") return false;
  const lower = ua.toLowerCase();
  return (
    lower.includes("postman") ||
    lower.includes("postmanruntime") ||
    lower.includes("burp") ||
    lower.includes("burpcollaborator") ||
    lower.includes("curl/") ||
    lower.includes("wget/") ||
    lower.includes("python-requests") ||
    lower.includes("python-urllib") ||
    lower.includes("go-http-client") ||
    lower.includes("insomnia") ||
    lower.includes("httpie") ||
    lower.includes("node-fetch") ||
    lower.includes("axios/") ||
    lower.includes("undici")
  );
}

/**
 * Ekstraksi fingerprint sederhana dari User-Agent (OS Family + Browser Family).
 */
export function extractUaFingerprint(ua?: string | null): { os: string; browser: string } {
  if (!ua || typeof ua !== "string") return { os: "unknown", browser: "unknown" };
  const lower = ua.toLowerCase();

  // 1. Deteksi OS
  let os = "other";
  if (lower.includes("windows")) os = "windows";
  else if (lower.includes("macintosh") || lower.includes("mac os")) os = "macos";
  else if (lower.includes("android")) os = "android";
  else if (lower.includes("iphone") || lower.includes("ipad") || lower.includes("ios")) os = "ios";
  else if (lower.includes("linux")) os = "linux";

  // 2. Deteksi Browser
  let browser = "other";
  if (lower.includes("postmanruntime") || lower.includes("postman")) browser = "postman";
  else if (lower.includes("curl")) browser = "curl";
  else if (lower.includes("edg/")) browser = "edge";
  else if (lower.includes("opr/") || lower.includes("opera")) browser = "opera";
  else if (lower.includes("chrome") && !lower.includes("edg/")) browser = "chrome";
  else if (lower.includes("firefox")) browser = "firefox";
  else if (lower.includes("safari") && !lower.includes("chrome")) browser = "safari";

  return { os, browser };
}

/**
 * Memvalidasi kesesuaian User-Agent antara sesi tersimpan dan incoming request.
 */
export function isUserAgentMatching(savedUa?: string | null, incomingUa?: string | null): boolean {
  if (!savedUa) return true; // Sesi lama tanpa UA tersimpan diizinkan
  if (!incomingUa) return false; // Sesi tersimpan memiliki UA, tapi incoming request tanpa UA -> tolak

  const savedFp = extractUaFingerprint(savedUa);
  const incomingFp = extractUaFingerprint(incomingUa);

  // Jika sesi asli dari browser resmi, tapi incoming dari Postman / cURL / tool lain -> tolak seketika
  if (savedFp.browser !== "postman" && savedFp.browser !== "curl" && isAutomatedToolUserAgent(incomingUa)) {
    return false;
  }

  // Jika Browser Family atau OS Family berbeda -> tolak
  if (savedFp.os !== incomingFp.os || savedFp.browser !== incomingFp.browser) {
    return false;
  }

  return true;
}

/**
 * Normalisasi dan perbandingan Subnet IP (/24 untuk IPv4, /64 untuk IPv6).
 */
export function isSubnetMatching(savedIp?: string | null, incomingIp?: string | null): boolean {
  if (!savedIp || !incomingIp) return true;

  const cleanSaved = savedIp.trim().replace(/^::ffff:/, "");
  const cleanIncoming = incomingIp.trim().replace(/^::ffff:/, "");

  if (cleanSaved === cleanIncoming) return true;

  // Localhost matching
  const isLocalSaved = cleanSaved === "127.0.0.1" || cleanSaved === "::1" || cleanSaved === "localhost";
  const isLocalIncoming = cleanIncoming === "127.0.0.1" || cleanIncoming === "::1" || cleanIncoming === "localhost";
  if (isLocalSaved && isLocalIncoming) return true;

  // IPv4 Subnet /24 check (3 oktet pertama sama)
  const isIpv4Saved = /^\d+\.\d+\.\d+\.\d+$/.test(cleanSaved);
  const isIpv4Incoming = /^\d+\.\d+\.\d+\.\d+$/.test(cleanIncoming);
  if (isIpv4Saved && isIpv4Incoming) {
    const savedParts = cleanSaved.split(".");
    const incomingParts = cleanIncoming.split(".");
    return savedParts[0] === incomingParts[0] && savedParts[1] === incomingParts[1] && savedParts[2] === incomingParts[2];
  }

  // IPv6 Subnet /64 check (4 segmen pertama sama)
  if (cleanSaved.includes(":") && cleanIncoming.includes(":")) {
    const savedSegments = cleanSaved.split(":").slice(0, 4).join(":");
    const incomingSegments = cleanIncoming.split(":").slice(0, 4).join(":");
    return savedSegments === incomingSegments;
  }

  return false;
}

/**
 * Verifikasi menyeluruh Session Binding (Anti-Hijacking).
 */
export function verifySessionBinding(
  session: { ip?: string | null; userAgent?: string | null },
  context?: SessionBindingContext,
): SessionVerificationResult {
  if (!context) return { valid: true };

  // 1. Validasi User-Agent
  if (context.userAgent && !isUserAgentMatching(session.userAgent, context.userAgent)) {
    return { valid: false, reason: "USER_AGENT_MISMATCH" };
  }

  // 2. Validasi IP / Subnet
  if (context.ip && session.ip) {
    if (context.strictIp) {
      const cleanSaved = session.ip.trim().replace(/^::ffff:/, "");
      const cleanIncoming = context.ip.trim().replace(/^::ffff:/, "");
      if (cleanSaved !== cleanIncoming) {
        return { valid: false, reason: "IP_MISMATCH" };
      }
    } else if (!isSubnetMatching(session.ip, context.ip)) {
      return { valid: false, reason: "IP_MISMATCH" };
    }
  }

  return { valid: true };
}
