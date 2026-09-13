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
    <AdminPageShell title="Admin" home>
      <Text>Masuk sebagai {me.user.email}.</Text>
      <Text>
        Notifikasi kurasi: <strong>{inbox.pendingCount}</strong> bukti menunggu.
      </Text>
      <Text c="dimmed">
        Hanya bukti yang diunggah di dashboard yang boleh dikurasi. Screenshot chat tidak mengkredit poin.
      </Text>
      <AdminInbox items={inbox.items} />
    </AdminPageShell>
  );
}
