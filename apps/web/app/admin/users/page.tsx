import { AdminUsersPageView } from "@/views/admin/users";
import { ADMIN_PAGE_SIZE, parseOffset, type AdminUserRow } from "@/lib/admin";
import { fetchAdminApi, loadAdminMe } from "@/lib/server-api";

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
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const offset = parseOffset(sp.offset);
  const users = me ? await loadUsers(q, offset) : [];
  return <AdminUsersPageView me={me} users={users} q={q} offset={offset} />;
}