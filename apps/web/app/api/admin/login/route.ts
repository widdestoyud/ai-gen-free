import { NextRequest } from "next/server";
import { adminSignIn } from "@/auth-admin";
import { parseAuthBridgeError } from "@/lib/otp-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { username?: unknown; password?: unknown };
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) {
    return Response.json(
      { error: { code: "A001", message: "Username dan kata sandi wajib diisi" } },
      { status: 400 },
    );
  }

  try {
    const result = await adminSignIn("password", { username, password, redirect: false });
    if (result && typeof result === "object" && "error" in result && result.error) {
      return Response.json(
        { error: { code: "A012", message: "Kata sandi yang Anda masukkan salah." } },
        { status: 401 },
      );
    }
    return Response.json({ ok: true });
  } catch (err) {
    const parsed = parseAuthBridgeError(err);
    return Response.json(
      {
        transaction_id: parsed.transaction_id,
        error: { code: parsed.code || "A012", message: parsed.message },
      },
      {
        status: parsed.code === "A008" ? 429 : parsed.code === "A019" ? 409 : 401,
        headers: parsed.transaction_id ? { "x-transaction-id": parsed.transaction_id } : undefined,
      },
    );
  }
}
