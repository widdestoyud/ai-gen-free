import { AdminPageShell, AdminUnauth } from "@/views/admin/components/admin-page-shell";
import { AdminJobsList } from "./components/jobs-list";
import type { AdminJobRow } from "@/lib/admin";

export function AdminJobsPageView({
  me,
  jobs,
  q,
  status,
  userId,
  offset,
}: {
  me: unknown;
  jobs: AdminJobRow[];
  q: string;
  status: string;
  userId: string;
  offset: number;
}) {
  if (!me) return <AdminUnauth />;

  return (
    <AdminPageShell title="Daftar job">
      <AdminJobsList jobs={jobs} q={q} status={status} userId={userId} offset={offset} />
    </AdminPageShell>
  );
}
