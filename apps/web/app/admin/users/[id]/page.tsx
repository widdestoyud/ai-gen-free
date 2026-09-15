import { Text } from "@mantine/core";
import { AdminPageShell, AdminUnauth } from "@/views/admin/components/admin-page-shell";
import { AppLink } from "@/components/app-link";
import type { AdminUserRow } from "@/lib/admin";
import { fetchAdminApi, loadAdminMe } from "@/lib/server-api";
import { AdminUserDetail } from "@/views/admin/users/components/user-detail";

async function loadUser(id: string): Promise<AdminUserRow | null | "error"> {
  const res = await fetchAdminApi(`/api/admin/users/${id}`);
  if (!res) return "error";
  if (res.status === 404) return null;
  if (!res.ok) return "error";
  return (await res.json()) as AdminUserRow;
}

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await loadAdminMe();
  if (!me) return <AdminUnauth />;
  const { id } = await params;
  const user = await loadUser(id);
  if (user === "error") return <AdminUnauth />;
  if (!user) {
    return (
      <AdminPageShell title="Detail User" backHref="/admin/users" backLabel="← Kembali ke daftar user">
        <Text>User tidak ditemukan.</Text>
      </AdminPageShell>
    );
  }
  return (
    <AdminPageShell title="Detail User" backHref="/admin/users" backLabel="← Kembali ke daftar user">
      <AdminUserDetail user={user} />
    </AdminPageShell>
  );
}