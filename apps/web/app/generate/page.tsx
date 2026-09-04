import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GenerateClient } from "./generate-client";

const apiBase = () => process.env.API_INTERNAL_URL ?? "http://localhost:3001";

async function load() {
  const jar = await cookies();
  const sid = jar.get("sid")?.value;
  if (!sid) return null;
  const headers = { cookie: `sid=${sid}` };
  const [wallet, catalog, jobs] = await Promise.all([
    fetch(`${apiBase()}/api/wallet`, { headers, cache: "no-store" }),
    fetch(`${apiBase()}/api/catalog/generate`, { headers, cache: "no-store" }),
    fetch(`${apiBase()}/api/jobs`, { headers, cache: "no-store" }),
  ]);
  if (!wallet.ok) return null;
  return {
    wallet: (await wallet.json()) as { available: number; held: number },
    models: ((await catalog.json()) as { models: Model[] }).models,
    jobs: ((await jobs.json()) as { jobs: JobRow[] }).jobs,
  };
}

export type Model = { mode: string; modelId: string; providerId: string; costPoints: number };
export type JobRow = { id: string; status: string; progressPct: number; createdAt: string };

export default async function GeneratePage() {
  const data = await load();
  if (!data) redirect("/login");
  return (
    <main style={{ maxWidth: 720, margin: "3rem auto", padding: "0 1.5rem" }}>
      <p>
        <Link href="/" style={{ color: "#8ab4ff" }}>
          ← Beranda
        </Link>
      </p>
      <h1>Generate</h1>
      <GenerateClient available={data.wallet.available} held={data.wallet.held} models={data.models} jobs={data.jobs} />
    </main>
  );
}
