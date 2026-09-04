import { cookies } from "next/headers";
import Link from "next/link";
import { LogoutButton } from "./logout-button";

async function readHealth(): Promise<{ ok: boolean; detail: string }> {
  const base = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  try {
    const res = await fetch(`${base}/api/health`, { cache: "no-store" });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    const body = (await res.json()) as { ok?: boolean; service?: string };
    return { ok: Boolean(body.ok), detail: body.service ?? "api" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "gagal menghubungi API";
    return { ok: false, detail: message };
  }
}

async function readMe() {
  const jar = await cookies();
  const sid = jar.get("sid")?.value;
  if (!sid) return null;
  const base = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
  const res = await fetch(`${base}/api/me`, {
    cache: "no-store",
    headers: { cookie: `sid=${sid}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as { user: { email: string; role: string } };
}

export default async function HomePage() {
  const [health, me] = await Promise.all([readHealth(), readMe()]);

  return (
    <main style={{ maxWidth: 640, margin: "4rem auto", padding: "0 1.5rem" }}>
      <p style={{ letterSpacing: "0.08em", textTransform: "uppercase", color: "#9aa0a6", fontSize: 12 }}>
        M2 wallet
      </p>
      <h1 style={{ fontWeight: 600, fontSize: "2rem" }}>ai-gen-free</h1>
      {me ? (
        <div>
          <p>Kamu masuk sebagai {me.user.email}.</p>
          <p>
            <Link href="/wallet" style={{ color: "#8ab4ff" }}>
              Buka dompet
            </Link>
          </p>
          <LogoutButton />
        </div>
      ) : (
        <p>
          <Link href="/login" style={{ color: "#8ab4ff" }}>
            Masuk dengan email
          </Link>
        </p>
      )}
      <div
        style={{
          marginTop: "2rem",
          padding: "1rem 1.25rem",
          borderRadius: 12,
          border: "1px solid #2a2f3a",
          background: "#171a21",
        }}
      >
        <strong>Status API</strong>
        <p style={{ margin: "0.5rem 0 0", color: health.ok ? "#7ddea0" : "#ff8a80" }}>
          {health.ok ? `Terhubung (${health.detail})` : `Tidak terhubung — ${health.detail}`}
        </p>
      </div>
    </main>
  );
}
