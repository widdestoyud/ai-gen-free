"use client";

import { Text } from "@mantine/core";
import { AppLink } from "@/components/app-link";
import { ErrorAlert } from "@/components/error-alert";
import { PageShell } from "@/components/page-shell";
import { useEmailValidation } from "@/hooks/use-email-validation";

export function EmailValidationView({ token }: { token: string }) {
  const ctrl = useEmailValidation(token);

  return (
    <PageShell title="Verifikasi email" size="xs">
      {ctrl.status === "pending" ? <Text c="dimmed">Memeriksa tautan…</Text> : null}
      {ctrl.status === "ok" ? <Text>{ctrl.message}</Text> : null}
      {ctrl.status === "error" || ctrl.status === "idle" ? (
        <ErrorAlert message={ctrl.message} code={ctrl.errorCode} transactionId={ctrl.transactionId} />
      ) : null}
      <AppLink href="/">Kembali ke beranda</AppLink>
    </PageShell>
  );
}
