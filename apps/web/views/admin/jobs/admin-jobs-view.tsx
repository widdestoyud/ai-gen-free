import { AdminPageShell, AdminUnauth } from "@/views/admin/components/admin-page-shell";
import { AdminJobsList } from "./components/jobs-list";
import type { AdminJobRow } from "@/lib/admin";
import type { PaginationMeta } from "@/app/admin/page";

export function AdminJobsPageView({
  me,
  jobs,
  pagination,
  currentParams,
}: {
  me: unknown;
  jobs: AdminJobRow[];
  pagination?: PaginationMeta;
  currentParams?: {
    q?: string;
    status?: string;
    mode?: string;
    userId?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: string;
  };
}) {
  if (!me) return <AdminUnauth />;

  return (
    <AdminPageShell title="Daftar Job Generasi">
      <AdminJobsList
        jobs={jobs}
        pagination={pagination}
        currentParams={currentParams}
      />
    </AdminPageShell>
  );
}
