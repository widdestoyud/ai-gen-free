"use server";

/** Use-case sesi untuk halaman. Ganti NextAuth hanya di create-auth.ts — jangan impor next-auth dari UI (ADR 0012). */
import { adminAuth, adminSignIn, adminSignOut } from "@/auth-admin";
import { auth, signIn, signOut } from "@/auth";
import { adminBasicHeaders, apiBase } from "./server-api";

import { parseOtpError, type AuthActionResult } from "./otp-error";

export type { AuthActionResult };

function signInFailed(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const rec = result as { error?: unknown; ok?: unknown };
  if (rec.ok === false) return true;
  return typeof rec.error === "string" && rec.error.length > 0;
}

export async function verifyUserOtp(
  email: string,
  code: string,
): Promise<AuthActionResult> {
  try {
    const result = await signIn("otp", { email, code, redirect: false });
    if (signInFailed(result)) return { ok: false, code: "A002", message: "Kode salah" };
    return { ok: true };
  } catch (err) {
    const parsed = parseOtpError(err);
    return { ok: false, ...parsed };
  }
}

export async function logoutUser() {
  const session = await auth();
  if (session?.sid) {
    await fetch(`${apiBase()}/api/auth/logout`, {
      method: "POST",
      headers: { cookie: `sid=${session.sid}` },
    });
  }
  await signOut({ redirectTo: "/" });
}

export async function verifyAdminOtp(
  email: string,
  code: string,
): Promise<AuthActionResult> {
  try {
    const result = await adminSignIn("otp", { email, code, redirect: false });
    if (signInFailed(result)) return { ok: false, code: "A002", message: "Kode salah" };
    return { ok: true };
  } catch (err) {
    const parsed = parseOtpError(err);
    return { ok: false, ...parsed };
  }
}

export async function logoutAdmin() {
  const session = await adminAuth();
  if (session?.sid) {
    await fetch(`${apiBase()}/api/admin/auth/logout`, {
      method: "POST",
      headers: {
        cookie: `sid_admin=${session.sid}`,
        ...adminBasicHeaders(),
      },
    });
  }
  await adminSignOut({ redirectTo: "/admin" });
}
