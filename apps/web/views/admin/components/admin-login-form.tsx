"use client";

import { Button, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { ErrorAlert } from "@/components/error-alert";
import { PageShell } from "@/components/page-shell";
import { useAdminLogin } from "@/hooks/use-admin-login";
import { useI18n } from "@/lib/i18n";

export function AdminLoginForm() {
  const t = useI18n("admin");
  const ctrl = useAdminLogin();

  return (
    <PageShell title={t("login.page_title")} size="xs">
      <Text c="dimmed">{t("login.subtitle")}</Text>
      <form onSubmit={ctrl.submitLogin}>
        <Stack gap="sm">
          <TextInput
            label={t("login.username_label")}
            required
            value={ctrl.username}
            onChange={(ev) => ctrl.setUsername(ev.currentTarget.value)}
          />
          <PasswordInput
            label={t("login.password_label")}
            required
            value={ctrl.password}
            onChange={(ev) => ctrl.setPassword(ev.currentTarget.value)}
          />
          <ErrorAlert
            message={ctrl.error}
            code={ctrl.errorCode}
            transactionId={ctrl.transactionId}
          />
          <Button type="submit" disabled={ctrl.pending}>
            {ctrl.pending ? t("login.processing") : t("login.btn_submit")}
          </Button>
        </Stack>
      </form>
    </PageShell>
  );
}
