import { AdminPageShell, AdminUnauth } from "@/views/admin/components/admin-page-shell";
import { AdminUsersList } from "./components/users-list";
import type { AdminUserRow } from "@/lib/admin";

export function AdminUsersPageView({
  me,
  users,
  q,
  offset,
}: {
  me: unknown;
  users: AdminUserRow[];
  q: string;
  offset: number;
}) {
  if (!me) return <AdminUnauth />;

  return (
    <AdminPageShell title="Daftar user">
      <AdminUsersList users={users} q={q} offset={offset} />
    </AdminPageShell>
  );
}
