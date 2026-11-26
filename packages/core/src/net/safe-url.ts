const INTERNAL_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "::",
  "0.0.0.0",
  "metadata.google.internal",
  "redis",
  "api",
  "postgres",
  "worker",
  "web",
  "telemetry",
  "minio",
  "mailpit",
  "migrate",
]);

function isPrivateOrReservedIpv4(hostname: string): boolean {
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4Match) return false;

  const octet1 = parseInt(ipv4Match[1], 10);
  const octet2 = parseInt(ipv4Match[2], 10);
  const octet3 = parseInt(ipv4Match[3], 10);
  const octet4 = parseInt(ipv4Match[4], 10);

  if (octet1 > 255 || octet2 > 255 || octet3 > 255 || octet4 > 255) return true;
  if (octet1 === 10) return true;
  if (octet1 === 127) return true;
  if (octet1 === 169 && octet2 === 254) return true;
  if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return true;
  if (octet1 === 192 && octet2 === 168) return true;
  if (octet1 === 0) return true;
  return false;
}

function isPrivateOrReservedIpv6(bareHost: string): boolean {
  if (!bareHost.includes(":")) return false;
  if (
    bareHost === "::1" ||
    bareHost === "::" ||
    bareHost === "0:0:0:0:0:0:0:1" ||
    bareHost === "0:0:0:0:0:0:0:0"
  ) {
    return true;
  }
  if (bareHost.startsWith("::ffff:")) return true;
  if (/^fe[89ab]/i.test(bareHost)) return true;
  if (/^f[cd]/i.test(bareHost)) return true;
  return false;
}

/**
 * Validasi apakah URL publik aman untuk di-fetch oleh server/worker.
 * Memblokir loopback, private IPv4/IPv6 ranges, internal service names, dan link-local cloud metadata.
 */
export function isSafePublicUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const rawHost = parsed.hostname.toLowerCase().trim();
    if (!rawHost) return false;

    const bareHost =
      rawHost.startsWith("[") && rawHost.endsWith("]") ? rawHost.slice(1, -1) : rawHost;

    if (
      INTERNAL_HOSTNAMES.has(bareHost) ||
      bareHost.endsWith(".localhost") ||
      bareHost.endsWith(".local") ||
      bareHost.endsWith(".internal")
    ) {
      return false;
    }

    if (isPrivateOrReservedIpv4(bareHost)) return false;
    if (isPrivateOrReservedIpv6(bareHost)) return false;

    return true;
  } catch {
    return false;
  }
}
