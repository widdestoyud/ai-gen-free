import { Text } from "@mantine/core";
import { redirect } from "next/navigation";
import { AppLink } from "@/components/app-link";
import { PageShell } from "@/components/page-shell";
import type { JobView } from "@/lib/job-status";
import { fetchUserApi } from "@/lib/server-api";
import { JobClient } from "./job-client";

async function load(id: string): Promise<JobView | null | "unauth"> {
  const res = await fetchUserApi(`/api/jobs/${id}`);
  if (!res) return "unauth";
  if (res.status === 404) return null;
  if (!res.ok) return "unauth";
  return (await res.json()) as JobView;
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await load(id);
  if (job === "unauth") redirect("/login");
  if (!job) {
    return (
      <PageShell title="Job" backHref="/generate" backLabel="Kembali" size="md">
        <Text>Job tidak ditemukan.</Text>
        <AppLink href="/generate">Kembali</AppLink>
      </PageShell>
    );
  }
  return (
    <PageShell title="Job" backHref="/generate" backLabel="← Generate" size="md">
      <JobClient initial={job} />
    </PageShell>
  );
}
