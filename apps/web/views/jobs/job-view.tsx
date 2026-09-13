import { Text } from "@mantine/core";
import { AppLink } from "@/components/app-link";
import { PageShell } from "@/components/page-shell";
import type { JobView } from "@/lib/job-status";
import { JobClient } from "./components/job-client";

export function JobPageView({ job }: { job: JobView | null }) {
  if (!job) {
    return (
      <PageShell title="Job" backHref="/app/library" backLabel="Kembali ke Library" size="md">
        <Text>Job tidak ditemukan.</Text>
        <AppLink href="/app/library">Kembali ke Library</AppLink>
      </PageShell>
    );
  }
  return (
    <PageShell title="Job" backHref="/app/library" backLabel="← Library" size="md">
      <JobClient initial={job} />
    </PageShell>
  );
}
