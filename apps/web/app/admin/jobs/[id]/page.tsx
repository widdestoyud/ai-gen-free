import { Text } from "@mantine/core";
import { AdminPageShell, AdminUnauth } from "@/views/admin/components/admin-page-shell";
import { AppLink } from "@/components/app-link";
import type { AdminJobDetailView } from "@/lib/admin";
import { fetchAdminApi, loadAdminMe } from "@/lib/server-api";
import { AdminJobDetail } from "@/views/admin/jobs/components/job-detail";

async function loadJob(id: string): Promise<AdminJobDetailView | null | "error"> {
  const res = await fetchAdminApi(`/api/admin/jobs/${id}`);
  if (!res) return "error";
  if (res.status === 404) return null;
  if (!res.ok) return "error";
  return (await res.json()) as AdminJobDetailView;
}

export default async function AdminJobPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await loadAdminMe();
  if (!me) return <AdminUnauth />;
  const { id } = await params;
  const job = await loadJob(id);
  if (job === "error") return <AdminUnauth />;
  if (!job) {
    return (
      <AdminPageShell title="Job">
        <Text>Job tidak ditemukan.</Text>
        <AppLink href="/admin/jobs">Kembali ke daftar</AppLink>
      </AdminPageShell>
    );
  }
  return (
    <AdminPageShell title="Job">
      <AdminJobDetail job={job} />
    </AdminPageShell>
  );
}