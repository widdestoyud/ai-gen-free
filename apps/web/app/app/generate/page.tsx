import { redirect } from "next/navigation";
import { fetchUserApi } from "@/lib/server-api";
import type { JobsListView, JobView } from "@/lib/job-status";
import { type Model, GeneratePageView } from "@/views/app/generate";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function load() {
  const [wallet, catalog, jobsRes, profileRes] = await Promise.all([
    fetchUserApi("/api/wallet"),
    fetchUserApi("/api/catalog/generate"),
    fetchUserApi("/api/generate"),
    fetchUserApi("/api/me"),
  ]);
  if (!wallet || !wallet.ok) return null;
  const jobsBody = jobsRes?.ok ? ((await jobsRes.json()) as JobsListView) : { jobs: [] as JobView[], nextGenerateAt: null };
  const catalogBody = catalog?.ok ? ((await catalog.json()) as { models?: Model[]; defaults?: any }) : { models: [] };
  const profileBody = profileRes?.ok ? ((await profileRes.json()) as { user?: { spicyModeEnabled?: boolean; uploadPolicyAcceptedAt?: string | null } }) : {};

  return {
    wallet: (await wallet.json()) as { available: number; held: number },
    models: catalogBody?.models ?? [],
    defaults: catalogBody?.defaults,
    jobs: jobsBody?.jobs ?? [],
    nextGenerateAt: jobsBody?.nextGenerateAt ?? null,
    spicyModeEnabled: Boolean(profileBody?.user?.spicyModeEnabled),
    uploadPolicyAccepted: Boolean(profileBody?.user?.uploadPolicyAcceptedAt),
  };
}

export default async function AppGeneratePage() {
  const data = await load();
  if (!data) redirect("/");
  return (
    <GeneratePageView
      available={data.wallet.available}
      held={data.wallet.held}
      models={data.models}
      defaults={data.defaults}
      jobs={data.jobs}
      nextGenerateAt={data.nextGenerateAt}
      initialSpicyModeEnabled={data.spicyModeEnabled}
      initialUploadPolicyAccepted={data.uploadPolicyAccepted}
    />
  );
}

