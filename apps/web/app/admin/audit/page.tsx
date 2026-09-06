import { AdminPageShell, AdminUnauth } from "@/components/admin-page-shell";
import { ADMIN_PAGE_SIZE, parseOffset, type AdminAuditItem } from "@/lib/admin";
import { fetchAdminApi, loadAdminMe } from "@/lib/server-api";
import { AdminAuditList } from "./audit-list";

async function loadAudit(opts: { action: string; offset: number }) {
  const params = new URLSearchParams();
  if (opts.action) params.set("action", opts.action);
  params.set("limit", String(ADMIN_PAGE_SIZE));
  params.set("offset", String(opts.offset));
  const res = await fetchAdminApi(`/api/admin/audit?${params.toString()}`);
  if (!res || !res.ok) return [] as AdminAuditItem[];
  return ((await res.json()) as { items: AdminAuditItem[] }).items;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; offset?: string }>;
}) {
  const me = await loadAdminMe();
  if (!me) return <AdminUnauth />;
  const sp = await searchParams;
  const action = sp.action?.trim() ?? "";
  const offset = parseOffset(sp.offset);
  const items = await loadAudit({ action, offset });
  return (
    <AdminPageShell title="Jejak audit">
      <AdminAuditList items={items} action={action} offset={offset} />
    </AdminPageShell>
  );
}