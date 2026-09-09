import { NextRequest } from "next/server";
import { signIn } from "@/auth";
import { parseAuthBridgeError } from "@/lib/otp-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return Response.json(
      { error: { code: "A001", message: "Email dan kata sandi wajib diisi" } },
      { status: 400 },
    );
  }

  try {
    const result = await signIn("password", { email, password, redirect: false });
    if (result && typeof result === "object" && "error" in result && result.error) {
      return Response.json(
        { error: { code: "A012", message: "Kata sandi yang Anda masukkan salah." } },
        { status: 401 },
      );
    }
    return Response.json({ ok: true });
  } catch (err) {
    const parsed = parseAuthBridgeError(err);
    if (parsed.requiresOtp) {
      return Response.json({
        ok: true,
        requiresOtp: true,
        email,
        message: parsed.message,
        transaction_id: parsed.transaction_id,
      });
    }
    return Response.json(
      {
        transaction_id: parsed.transaction_id,
        error: { code: parsed.code || "A012", message: parsed.message },
      },
      {
        status: parsed.code === "A008" ? 429 : parsed.code === "A013" ? 403 : 401,
        headers: parsed.transaction_id ? { "x-transaction-id": parsed.transaction_id } : undefined,
      },
    );
  }
}
