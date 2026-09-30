import { AdminPageShell, AdminUnauth } from "@/views/admin/components/admin-page-shell";
import { AdminSettingsForm } from "./components/settings-form";
import { AdminPaymentSettingsForm, type PaymentSettingsData } from "./components/payment-settings-form";

export function AdminSettingsPageView({
  me,
  value,
  paymentSettings,
}: {
  me: unknown;
  value: number;
  paymentSettings: PaymentSettingsData;
}) {
  if (!me) return <AdminUnauth />;

  return (
    <AdminPageShell title="Pengaturan Sistem">
      <AdminSettingsForm initialValue={value} />
      <AdminPaymentSettingsForm initialSettings={paymentSettings} />
    </AdminPageShell>
  );
}

