import type { Metadata } from "next";
import { AdminAuditPageView } from "@/views/admin/audit";
import { ADMIN_PAGE_SIZE, parseOffset, type AdminAuditItem } from "@/lib/admin";
import { fetchAdminApi, loadAdminMe } from "@/lib/server-api";

export const metadata: Metadata = {
  title: "Audit Log Aktivitas",
  description: "Log jejak aktivitas dan audit admin.",
  robots: { index: false, follow: false },
};

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
  const sp = await searchParams;
  const action = sp.action?.trim() ?? "";
  const offset = parseOffset(sp.offset);
  const items = me ? await loadAudit({ action, offset }) : [];
  return <AdminAuditPageView me={me} items={items} action={action} offset={offset} />;
}