import { headers as getNextHeaders } from "next/headers";
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

async function getForwardHeaders(): Promise<Record<string, string>> {
  try {
    const reqHeaders = await getNextHeaders();
    const result: Record<string, string> = {};
    const forwardList = [
      "user-agent",
      "cf-connecting-ip",
      "cf-ipcity",
      "cf-ipcountry",
      "cf-region",
      "cf-asorganization",
      "x-forwarded-for",
      "x-real-ip",
      "x-device-id",
    ];
    for (const key of forwardList) {
      const val = reqHeaders.get(key);
      if (val) result[key] = val;
    }
    return result;
  } catch {
    return {};
  }
}

export async function fetchUserApi(path: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    const session = await auth();
    if (!session?.sid) return null;
    const forwardHeaders = await getForwardHeaders();
    const headers = new Headers(init.headers);
    for (const [k, v] of Object.entries(forwardHeaders)) {
      if (!headers.has(k)) headers.set(k, v);
    }
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
    const forwardHeaders = await getForwardHeaders();
    const headers = new Headers(init.headers);
    for (const [k, v] of Object.entries(forwardHeaders)) {
      if (!headers.has(k)) headers.set(k, v);
    }
    headers.set("cookie", `sid_admin=${session.sid}`);
    for (const [key, value] of Object.entries(adminBasicHeaders())) {
      if (!headers.has(key)) headers.set(key, value);
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
        gender: string | null;
        uploadPolicyAcceptedAt?: string | null;
        hasUploads?: boolean;
        dateOfBirth?: string | null;
        spicyModeAcceptedAt?: string | null;
        spicyModeEnabled?: boolean;
      };
    };
  } catch {
    return null;
  }
}

export async function loadLibrary() {
  try {
    const res = await fetchUserApi("/api/library?type=all&limit=30&offset=0");
    if (!res || !res.ok) return null;
    return (await res.json()) as {
      total: number;
      limit: number;
      offset: number;
      items: Array<{
        id: string;
        type: "generated" | "upload";
        kind: "image" | "video";
        alias?: string | null;
        prompt?: string | null;
        model_id?: string | null;
        cost?: number | null;
        status: string;
        url: string | null;
        mime_type: string;
        width?: number | null;
        height?: number | null;
        size_bytes?: number | null;
        created_at: string;
        expires_at?: string | null;
        params?: Record<string, unknown> | null;
        is_spicy?: boolean;
      }>;
    };
  } catch {
    return null;
  }
}

export type PublicPackage = {
  id: string;
  name: string;
  label: string;
  description?: string | null;
  amountIdr: number;
  originalAmountIdr?: number | null;
  points: number;
  active?: boolean;
  sortOrder?: number;
  badgeText?: string | null;
};

export async function loadPublicPackages(): Promise<PublicPackage[]> {
  try {
    const res = await fetch(`${apiBase()}/customer/packages`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { packages?: PublicPackage[] };
    return Array.isArray(json.packages) ? json.packages : [];
  } catch {
    return [];
  }
}

