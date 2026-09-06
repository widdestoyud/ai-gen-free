import { AdminPageShell, AdminUnauth } from "@/components/admin-page-shell";
import { ADMIN_PAGE_SIZE, parseOffset, type AdminUserRow } from "@/lib/admin";
import { fetchAdminApi, loadAdminMe } from "@/lib/server-api";
import { AdminUsersList } from "./users-list";

async function loadUsers(q: string, offset: number) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  params.set("limit", String(ADMIN_PAGE_SIZE));
  params.set("offset", String(offset));
  const res = await fetchAdminApi(`/api/admin/users?${params.toString()}`);
  if (!res || !res.ok) return [] as AdminUserRow[];
  return ((await res.json()) as { users: AdminUserRow[] }).users;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; offset?: string }>;
}) {
  const me = await loadAdminMe();
  if (!me) return <AdminUnauth />;
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const offset = parseOffset(sp.offset);
  const users = await loadUsers(q, offset);
  return (
    <AdminPageShell title="Daftar user">
      <AdminUsersList users={users} q={q} offset={offset} />
    </AdminPageShell>
  );
}