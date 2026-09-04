async function readHealth(): Promise<{ ok: boolean; detail: string }> {
  const base = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  try {
    const res = await fetch(`${base}/api/health`, { cache: "no-store" });
    if (!res.ok) {
      return { ok: false, detail: `HTTP ${res.status}` };
    }
    const body = (await res.json()) as { ok?: boolean; service?: string };
    return { ok: Boolean(body.ok), detail: body.service ?? "api" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "gagal menghubungi API";
    return { ok: false, detail: message };
  }
}

export default async function HomePage() {
  const health = await readHealth();

  return (
    <main style={{ maxWidth: 640, margin: "4rem auto", padding: "0 1.5rem" }}>
      <p style={{ letterSpacing: "0.08em", textTransform: "uppercase", color: "#9aa0a6", fontSize: 12 }}>
        M0 scaffold
      </p>
      <h1 style={{ fontWeight: 600, fontSize: "2rem" }}>ai-gen-free</h1>
      <p style={{ lineHeight: 1.5, color: "#c5c9d1" }}>
        Fondasi layanan. Login, poin, dan generate menyusul di fase berikutnya.
      </p>
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
