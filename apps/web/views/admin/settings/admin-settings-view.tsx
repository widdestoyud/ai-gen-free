import { AdminPageShell, AdminUnauth } from "@/views/admin/components/admin-page-shell";
import { AdminSettingsForm } from "./components/settings-form";
import { AdminPaymentSettingsForm, type PaymentSettingsData } from "./components/payment-settings-form";
import { AdminTesterAccountForm, type TesterAccountSettingsData } from "./components/tester-account-form";

export function AdminSettingsPageView({
  me,
  value,
  paymentSettings,
  testerAccountSettings,
}: {
  me: unknown;
  value: number;
  paymentSettings: PaymentSettingsData;
  testerAccountSettings: TesterAccountSettingsData;
}) {
  if (!me) return <AdminUnauth />;

  return (
    <AdminPageShell title="Pengaturan Sistem">
      <AdminSettingsForm initialValue={value} />
      <AdminPaymentSettingsForm initialSettings={paymentSettings} />
      <AdminTesterAccountForm initialSettings={testerAccountSettings} />
    </AdminPageShell>
  );
}

