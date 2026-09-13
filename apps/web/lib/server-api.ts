import { adminAuth } from "@/auth-admin";
import { auth } from "@/auth";
import { resolveBackendPath } from "./api-mapping";

export function apiBase(): string {
  return process.env.API_INTERNAL_URL ?? "http://localhost:4000";
}

export function adminBasicHeaders(): Record<string, string> {
  const user = process.env.ADMIN_BASIC_USER ?? "";
  const pass = process.env.ADMIN_BASIC_PASSWORD ?? "";
  if (!user || !pass) return {};
  return { authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}` };
}

export async function fetchUserApi(path: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    const session = await auth();
    if (!session?.sid) return null;
    const headers = new Headers(init.headers);
    headers.set("cookie", `sid=${session.sid}`);
    const method = init.method ?? "GET";
    const backendPath = resolveBackendPath(path, method);
    return await fetch(`${apiBase()}${backendPath}`, { cache: "no-store", ...init, headers });
  } catch {
    return null;
  }
}

export async function fetchAdminApi(path: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    const session = await adminAuth();
    if (!session?.sid) return null;
    const headers = new Headers(init.headers);
    headers.set("cookie", `sid_admin=${session.sid}`);
    for (const [key, value] of Object.entries(adminBasicHeaders())) {
      headers.set(key, value);
    }
    const method = init.method ?? "GET";
    const backendPath = resolveBackendPath(path, method);
    return await fetch(`${apiBase()}${backendPath}`, { cache: "no-store", ...init, headers });
  } catch {
    return null;
  }
}

export async function loadAdminMe() {
  try {
    const res = await fetchAdminApi("/api/admin/me");
    if (!res || !res.ok) return null;
    return (await res.json()) as { user: { id: string; email: string; role: string } };
  } catch {
    return null;
  }
}

export async function loadCustomerProfile() {
  try {
    const res = await fetchUserApi("/api/user/profile");
    if (!res || !res.ok) return null;
    return (await res.json()) as {
      user: {
        id: string;
        email: string;
        displayName: string | null;
        phoneNumber: string | null;
        ktp: string | null;
        address: string | null;
      };
    };
  } catch {
    return null;
  }
}

export async function loadLibrary() {
  try {
    const res = await fetchUserApi("/api/library");
    if (!res || !res.ok) return null;
    return (await res.json()) as {
      jobs: import("./job-status").JobView[];
      nextGenerateAt: string | null;
    };
  } catch {
    return null;
  }
}
