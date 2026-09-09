import { Text } from "@mantine/core";
import { AdminLoginForm } from "@/components/admin-login-form";
import { AdminPageShell } from "@/components/admin-page-shell";
import { fetchAdminApi, loadAdminMe } from "@/lib/server-api";
import { AdminInbox } from "./admin-inbox";

async function notifications() {
  const res = await fetchAdminApi("/api/admin/notifications");
  if (!res || !res.ok) return { pendingCount: 0, items: [] as InboxItem[] };
  return (await res.json()) as { pendingCount: number; items: InboxItem[] };
}

export type InboxItem = {
  invoiceId: string;
  uniqueCode: string;
  email: string;
  amountIdr: number;
  points: number;
  proofSubmittedAt: string | null;
  status: string;
};

export default async function AdminHomePage() {
  const me = await loadAdminMe();
  if (!me) return <AdminLoginForm />;
  const inbox = await notifications();
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
