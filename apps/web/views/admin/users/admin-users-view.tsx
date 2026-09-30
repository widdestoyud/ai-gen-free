import { AdminPageShell, AdminUnauth } from "@/views/admin/components/admin-page-shell";
import { AdminUsersList } from "./components/users-list";
import type { AdminUserRow } from "@/lib/admin";
import type { PaginationMeta } from "@/app/admin/page";

export function AdminUsersPageView({
  me,
  users,
  pagination,
  currentParams,
}: {
  me: unknown;
  users: AdminUserRow[];
  pagination?: PaginationMeta;
  currentParams?: {
    q?: string;
    role?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: string;
  };
}) {
  if (!me) return <AdminUnauth />;

  return (
    <AdminPageShell title="Daftar Pengguna">
      <AdminUsersList
        users={users}
        pagination={pagination}
        currentParams={currentParams}
      />
    </AdminPageShell>
  );
}
