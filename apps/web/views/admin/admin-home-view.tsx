import { Text } from "@mantine/core";
import { AdminLoginForm } from "./components/admin-login-form";
import { AdminPageShell } from "./components/admin-page-shell";
import { AdminInbox } from "./components/admin-inbox";
import type { AdminInvoiceItem } from "@/app/admin/page";

export function AdminHomeView({
  me,
  inbox,
  allInvoices = [],
}: {
  me: { user: { id: string; email: string; role: string } } | null;
  inbox: {
    pendingCount: number;
    openCount: number;
    items: AdminInvoiceItem[];
    openItems: AdminInvoiceItem[];
  };
  allInvoices?: AdminInvoiceItem[];
}) {
  if (!me) return <AdminLoginForm />;

  return (
    <AdminPageShell title="Pesanan & Kurasi" home>
      <Text size="sm" c="dimmed" mb="xs">
        Masuk sebagai <strong>{me.user.email}</strong> · Menunggu Kurasi:{" "}
        <strong>{inbox.pendingCount}</strong> bukti · Pesanan Sedang Open:{" "}
        <strong>{inbox.openCount}</strong> order.
      </Text>
      <Text size="sm" c="dimmed" mb="md">
        Pantau pesanan open/aktif serta kurasi bukti pembayaran transfer manual di bawah ini.
      </Text>
      <AdminInbox
        items={inbox.items}
        openItems={inbox.openItems}
        allInvoices={allInvoices}
        pendingCount={inbox.pendingCount}
        openCount={inbox.openCount}
      />
    </AdminPageShell>
  );
}
