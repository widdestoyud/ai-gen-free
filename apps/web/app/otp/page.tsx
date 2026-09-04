"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function OtpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const body = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        setError(body.error?.message ?? "Kode salah");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Tidak bisa menghubungi server");
    } finally {
      setPending(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "4rem auto", padding: "0 1.5rem" }}>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 600 }}>Kode OTP</h1>
      <p style={{ color: "#c5c9d1" }}>Masukkan 6 digit yang dikirim ke {email || "email kamu"}.</p>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 24 }}>
        <label>
          Kode
          <input
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            required
            value={code}
            onChange={(ev) => setCode(ev.target.value.replace(/\D/g, "").slice(0, 6))}
            style={{
              display: "block",
              width: "100%",
              marginTop: 6,
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #2a2f3a",
              background: "#171a21",
              color: "#e8eaed",
              letterSpacing: "0.3em",
              boxSizing: "border-box",
            }}
          />
        </label>
        {error ? <p style={{ color: "#ff8a80" }}>{error}</p> : null}
        <button
          type="submit"
          disabled={pending || code.length !== 6}
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            border: 0,
            background: "#3d7dff",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {pending ? "Memeriksa…" : "Masuk"}
        </button>
      </form>
    </main>
  );
}

export default function OtpPage() {
  return (
    <Suspense fallback={<main style={{ padding: "4rem" }}>Memuat…</main>}>
      <OtpForm />
    </Suspense>
  );
}
