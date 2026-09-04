"use client";

import { FormEvent, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/admin/auth/otp/request", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        setError(body.error?.message ?? "Gagal mengirim OTP");
        return;
      }
      setStage("code");
    } catch {
      setError("Tidak bisa menghubungi server");
    } finally {
      setPending(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const res = await fetch("/api/admin/auth/otp/verify", {
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
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Tidak bisa menghubungi server");
    } finally {
      setPending(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "4rem auto", padding: "0 1.5rem" }}>
      <h1 style={{ fontSize: "1.6rem", fontWeight: 600 }}>Admin</h1>
      <p style={{ color: "#c5c9d1" }}>Bukan halaman pelanggan. OTP hanya untuk akun admin.</p>
      <form onSubmit={stage === "email" ? requestCode : verify} style={{ display: "grid", gap: 12, marginTop: 24 }}>
        <label>
          Email admin
          <input
            type="email"
            required
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            style={inputStyle}
          />
        </label>
        {stage === "code" ? (
          <label>
            Kode OTP
            <input
              inputMode="numeric"
              maxLength={6}
              required
              value={code}
              onChange={(ev) => setCode(ev.target.value.replace(/\D/g, "").slice(0, 6))}
              style={inputStyle}
            />
          </label>
        ) : null}
        {error ? <p style={{ color: "#ff8a80" }}>{error}</p> : null}
        <button type="submit" disabled={pending} style={buttonStyle}>
          {pending ? "Memproses…" : stage === "email" ? "Kirim kode" : "Masuk admin"}
        </button>
      </form>
    </main>
  );
}

const inputStyle: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 6,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #2a2f3a",
  background: "#171a21",
  color: "#e8eaed",
  boxSizing: "border-box",
};

const buttonStyle: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: 0,
  background: "#3d7dff",
  color: "white",
  fontWeight: 600,
  cursor: "pointer",
};
