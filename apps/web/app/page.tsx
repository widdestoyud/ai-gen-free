import { Text } from "@mantine/core";
import { AppLink } from "@/components/app-link";
import { ItemCard } from "@/components/item-card";
import { PageShell } from "@/components/page-shell";
import { StatusText } from "@/components/status-text";
import { auth } from "@/auth";
import { LogoutButton } from "./logout-button";

async function readHealth(): Promise<{ ok: boolean; detail: string }> {
  const base = process.env.API_INTERNAL_URL ?? "http://api:4000";
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

export default async function HomePage() {
  const [health, session] = await Promise.all([readHealth(), auth()]);

  return (
    <PageShell kicker="Generator gambar" title="ai-gen-free">
      {session?.user ? (
        <div>
          <Text>Kamu masuk sebagai {session.user.email}.</Text>
          <Text>
            <AppLink href="/wallet">Buka dompet</AppLink>
            {" · "}
            <AppLink href="/generate">Generate</AppLink>
          </Text>
          <LogoutButton />
        </div>
      ) : (
        <Text>
          <AppLink href="/login">Masuk dengan email</AppLink>
        </Text>
      )}
      <ItemCard>
        <Text fw={600}>Status API</Text>
        <StatusText ok={health.ok}>
          {health.ok ? `Terhubung (${health.detail})` : `Tidak terhubung — ${health.detail}`}
        </StatusText>
      </ItemCard>
    </PageShell>
  );
}
