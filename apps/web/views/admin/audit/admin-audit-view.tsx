import { AdminPageShell, AdminUnauth } from "@/views/admin/components/admin-page-shell";
import { AdminAuditList } from "./components/audit-list";
import type { AdminAuditItem } from "@/lib/admin";

export function AdminAuditPageView({
  me,
  items,
  action,
  offset,
}: {
  me: unknown;
  items: AdminAuditItem[];
  action: string;
  offset: number;
}) {
  if (!me) return <AdminUnauth />;

  return (
    <AdminPageShell title="Jejak audit">
      <AdminAuditList items={items} action={action} offset={offset} />
    </AdminPageShell>
  );
}
