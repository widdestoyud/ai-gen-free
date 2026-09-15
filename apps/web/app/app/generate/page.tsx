import { redirect } from "next/navigation";
import { fetchUserApi } from "@/lib/server-api";
import { resolveUploadUrl } from "@/lib/format";
import type { JobsListView, JobView } from "@/lib/job-status";
import { type Model, GeneratePageView } from "@/views/app/generate";
import type { StudioUpload } from "@/hooks/use-generate-studio";

async function load() {
  const [wallet, catalog, jobsRes, uploadsRes] = await Promise.all([
    fetchUserApi("/api/wallet"),
    fetchUserApi("/api/catalog/generate"),
    fetchUserApi("/api/generate"),
    fetchUserApi("/api/customer-images?limit=9&offset=0"),
  ]);
  if (!wallet || !wallet.ok) return null;
  const jobsBody = jobsRes?.ok ? ((await jobsRes.json()) as JobsListView) : { jobs: [] as JobView[], nextGenerateAt: null };
  const uploadsBody = uploadsRes?.ok
    ? ((await uploadsRes.json()) as {
        total?: number;
        limit?: number;
        offset?: number;
        items?: Array<{
          id: string;
          url: string;
          key: string;
          alias?: string | null;
          width?: number;
          height?: number;
        }>;
      })
    : { items: [], total: 0 };

  const initialUploads: StudioUpload[] = (uploadsBody.items ?? []).map((item) => ({
    id: item.id,
    url: resolveUploadUrl(item.url, item.id),
    name: item.key.split("/").pop() ?? item.id,
    key: item.key,
    alias: item.alias ?? null,
    width: item.width,
    height: item.height,
  }));

  return {
    wallet: (await wallet.json()) as { available: number; held: number },
    models: catalog?.ok ? ((await catalog.json()) as { models: Model[] }).models : [],
    jobs: jobsBody?.jobs ?? [],
    nextGenerateAt: jobsBody?.nextGenerateAt ?? null,
    uploads: initialUploads,
    uploadsTotal: uploadsBody?.total ?? initialUploads.length,
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
      jobs={data.jobs}
      nextGenerateAt={data.nextGenerateAt}
      initialUploads={data.uploads}
      initialUploadsTotal={data.uploadsTotal}
    />
  );
}
