export function parseBasicAuth(
  header: string | undefined,
): { user: string; pass: string } | null {
  if (!header || !header.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const i = decoded.indexOf(":");
    if (i < 0) return null;
    return { user: decoded.slice(0, i), pass: decoded.slice(i + 1) };
  } catch {
    return null;
  }
}

export function basicAuthorized(header: string | undefined): boolean {
  const expectedUser = process.env.ADMIN_BASIC_USER ?? "";
  const expectedPass = process.env.ADMIN_BASIC_PASSWORD ?? "";
  if (!expectedUser || !expectedPass) return false;
  const parsed = parseBasicAuth(header);
  if (!parsed) return false;
  return parsed.user === expectedUser && parsed.pass === expectedPass;
}
