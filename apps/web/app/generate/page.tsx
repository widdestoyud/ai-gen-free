import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { fetchUserApi } from "@/lib/server-api";
import type { JobsListView, JobView } from "@/lib/job-status";
import { GenerateClient } from "./generate-client";

async function load() {
  const [wallet, catalog, jobs] = await Promise.all([
    fetchUserApi("/api/wallet"),
    fetchUserApi("/api/catalog/generate"),
    fetchUserApi("/api/jobs"),
  ]);
  if (!wallet || !wallet.ok) return null;
  const jobsBody = jobs?.ok ? ((await jobs.json()) as JobsListView) : { jobs: [] as JobView[], nextGenerateAt: null };
  return {
    wallet: (await wallet.json()) as { available: number; held: number },
    models: catalog?.ok ? ((await catalog.json()) as { models: Model[] }).models : [],
    jobs: jobsBody.jobs,
    nextGenerateAt: jobsBody.nextGenerateAt ?? null,
  };
}

export type Model = {
  mode: string;
  modelId: string;
  displayName: string;
  providerId: string;
  costPoints: number;
};

export default async function GeneratePage() {
  const data = await load();
  if (!data) redirect("/login");
  return (
    <PageShell title="Generate" backHref="/" backLabel="← Beranda" size="md">
      <GenerateClient
        available={data.wallet.available}
        held={data.wallet.held}
        models={data.models}
        jobs={data.jobs}
        nextGenerateAt={data.nextGenerateAt}
      />
    </PageShell>
  );
}
