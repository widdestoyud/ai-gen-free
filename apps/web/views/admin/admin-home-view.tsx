import { Text } from "@mantine/core";
import { AdminLoginForm } from "./components/admin-login-form";
import { AdminPageShell } from "./components/admin-page-shell";
import { AdminInbox } from "./components/admin-inbox";
import type { InboxItem } from "@/app/admin/page";

export function AdminHomeView({
  me,
  inbox,
}: {
  me: { user: { id: string; email: string; role: string } } | null;
  inbox: { pendingCount: number; items: InboxItem[] };
}) {
  if (!me) return <AdminLoginForm />;

  return (
    <AdminPageShell title="Kurasi" home>
      <Text size="sm" c="dimmed" mb="xs">
        Masuk sebagai <strong>{me.user.email}</strong> · Notifikasi: <strong>{inbox.pendingCount}</strong> bukti menunggu kurasi.
      </Text>
      <Text size="sm" c="dimmed" mb="md">
        Hanya bukti yang diunggah di dashboard yang boleh dikurasi. Screenshot chat tidak mengkredit poin.
      </Text>
      <AdminInbox items={inbox.items} />
    </AdminPageShell>
  );
}
