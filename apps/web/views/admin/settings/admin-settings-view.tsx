import { AdminPageShell, AdminUnauth } from "@/views/admin/components/admin-page-shell";
import { AdminSettingsForm } from "./components/settings-form";

export function AdminSettingsPageView({
  me,
  value,
}: {
  me: unknown;
  value: number;
}) {
  if (!me) return <AdminUnauth />;

  return (
    <AdminPageShell title="Pengaturan cooldown">
      <AdminSettingsForm initialValue={value} />
    </AdminPageShell>
  );
}
