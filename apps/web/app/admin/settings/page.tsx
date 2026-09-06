import { AdminPageShell, AdminUnauth } from "@/components/admin-page-shell";
import { GENERATE_COOLDOWN_DEFAULT } from "@/lib/admin";
import { fetchAdminApi, loadAdminMe } from "@/lib/server-api";
import { AdminSettingsForm } from "./settings-form";

async function loadSetting() {
  const res = await fetchAdminApi("/api/admin/settings/generate_cooldown_seconds");
  if (!res || !res.ok) return GENERATE_COOLDOWN_DEFAULT;
  const body = (await res.json()) as { value?: number };
  return typeof body.value === "number" ? body.value : GENERATE_COOLDOWN_DEFAULT;
}

export default async function AdminSettingsPage() {
  const me = await loadAdminMe();
  if (!me) return <AdminUnauth />;
  const value = await loadSetting();
  return (
    <AdminPageShell title="Pengaturan cooldown">
      <AdminSettingsForm initialValue={value} />
    </AdminPageShell>
  );
}