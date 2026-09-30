import { AdminPageShell, AdminUnauth } from "@/views/admin/components/admin-page-shell";
import { AdminAuditList } from "./components/audit-list";
import type { AdminAuditItem } from "@/lib/admin";
import type { PaginationMeta } from "@/app/admin/page";

export function AdminAuditPageView({
  me,
  items,
  pagination,
  currentParams,
}: {
  me: unknown;
  items: AdminAuditItem[];
  pagination?: PaginationMeta;
  currentParams?: {
    action?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: string;
  };
}) {
  if (!me) return <AdminUnauth />;

  return (
    <AdminPageShell title="Jejak Audit Aktivitas">
      <AdminAuditList
        items={items}
        pagination={pagination}
        currentParams={currentParams}
      />
    </AdminPageShell>
  );
}
