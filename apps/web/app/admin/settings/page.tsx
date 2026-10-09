import type { Metadata } from "next";
import { AdminSettingsPageView } from "@/views/admin/settings";
import { GENERATE_COOLDOWN_DEFAULT } from "@/lib/admin";
import { fetchAdminApi, loadAdminMe } from "@/lib/server-api";
import type { PaymentSettingsData } from "@/views/admin/settings/components/payment-settings-form";
import type { TesterAccountSettingsData } from "@/views/admin/settings/components/tester-account-form";

export const metadata: Metadata = {
  title: "Pengaturan Sistem",
  description: "Pengaturan cooldown dan parameter global sistem.",
  robots: { index: false, follow: false },
};

async function loadSetting() {
  const res = await fetchAdminApi("/api/admin/settings/generate_cooldown_seconds");
  if (!res || !res.ok) return GENERATE_COOLDOWN_DEFAULT;
  const body = (await res.json()) as { value?: number };
  return typeof body.value === "number" ? body.value : GENERATE_COOLDOWN_DEFAULT;
}

async function loadPaymentSettings(): Promise<PaymentSettingsData> {
  const defaultSettings: PaymentSettingsData = {
    manualPaymentEnabled: true,
    activeOnlineGateway: "xendit",
    manualExpiryMinutes: 60,
    onlineExpiryMinutes: 10,
  };
  const res = await fetchAdminApi("/api/admin/settings/payment");
  if (!res || !res.ok) return defaultSettings;
  const body = (await res.json()) as PaymentSettingsData;
  return {
    manualPaymentEnabled: body.manualPaymentEnabled ?? true,
    activeOnlineGateway: body.activeOnlineGateway ?? "xendit",
    manualExpiryMinutes: body.manualExpiryMinutes ?? 60,
    onlineExpiryMinutes: body.onlineExpiryMinutes ?? 10,
  };
}

async function loadTesterAccountSettings(): Promise<TesterAccountSettingsData> {
  const defaultSettings: TesterAccountSettingsData = {
    enabled: true,
    email: "reviewer-pg@satulabs.id",
    otp: "201026",
    expiresAt: "2026-10-20T23:59:59.999Z",
  };
  const res = await fetchAdminApi("/api/admin/settings/tester-account");
  if (!res || !res.ok) return defaultSettings;
  const body = (await res.json()) as TesterAccountSettingsData;
  return {
    enabled: body.enabled ?? true,
    email: body.email || "reviewer-pg@satulabs.id",
    otp: body.otp || "201026",
    expiresAt: body.expiresAt || "2026-10-20T23:59:59.999Z",
  };
}

export default async function AdminSettingsPage() {
  const me = await loadAdminMe();
  const [value, paymentSettings, testerAccountSettings] = me
    ? await Promise.all([loadSetting(), loadPaymentSettings(), loadTesterAccountSettings()])
    : [
        GENERATE_COOLDOWN_DEFAULT,
        {
          manualPaymentEnabled: true,
          activeOnlineGateway: "xendit" as const,
          manualExpiryMinutes: 60,
          onlineExpiryMinutes: 10,
        },
        {
          enabled: true,
          email: "reviewer-pg@satulabs.id",
          otp: "201026",
          expiresAt: "2026-10-20T23:59:59.999Z",
        },
      ];
  return (
    <AdminSettingsPageView
      me={me}
      value={value}
      paymentSettings={paymentSettings}
      testerAccountSettings={testerAccountSettings}
    />
  );
}