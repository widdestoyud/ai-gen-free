import { NextRequest } from "next/server";
import { signIn } from "@/auth";
import { parseOtpError } from "@/lib/otp-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: unknown;
      code?: unknown;
    };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const code = typeof body.code === "string" ? body.code.trim() : "";

    if (!email || !code) {
      return Response.json(
        {
          error: {
            code: "A001",
            message: "Email dan kode OTP wajib diisi",
          },
        },
        { status: 400 },
      );
    }

    try {
      const result = await signIn("otp", { email, code, redirect: false });
      if (result && typeof result === "object" && "error" in result && result.error) {
        return Response.json(
          {
            error: {
              code: "A002",
              message: "Kode OTP salah",
            },
          },
          { status: 400 },
        );
      }
      return Response.json({ ok: true });
    } catch (err) {
      const parsed = parseOtpError(err);
      return Response.json(
        {
          transaction_id: parsed.transaction_id,
          error: {
            code: parsed.code || "A002",
            message: parsed.message || "Kode OTP salah",
          },
        },
        {
          status: 400,
          headers: parsed.transaction_id ? { "x-transaction-id": parsed.transaction_id } : undefined,
        },
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan server";
    return Response.json(
      {
        error: {
          code: "E002",
          message,
        },
      },
      { status: 500 },
    );
  }
}
