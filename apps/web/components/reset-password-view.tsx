"use client";

import { Button, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { AppLink } from "./app-link";
import { ErrorAlert } from "./error-alert";
import { PageShell } from "./page-shell";
import { useResetPassword } from "@/hooks/use-reset-password";

export function ResetPasswordView({ token }: { token: string }) {
  const ctrl = useResetPassword(token);

  return (
    <PageShell title="Reset kata sandi" size="xs" backHref="/" backLabel="← Beranda">
      {ctrl.checking ? <Text c="dimmed">Memeriksa tautan…</Text> : null}

      {!ctrl.hasToken && !ctrl.success ? (
        <form onSubmit={ctrl.requestReset}>
          <Stack gap="sm">
            <Text c="dimmed">Masukkan email terdaftar. Kami kirim tautan reset.</Text>
            <TextInput
              label="Email"
              type="email"
              required
              value={ctrl.email}
              onChange={(ev) => ctrl.setEmail(ev.currentTarget.value)}
            />
            <ErrorAlert message={ctrl.error} code={ctrl.errorCode} transactionId={ctrl.transactionId} />
            <Button type="submit" disabled={ctrl.pending}>
              {ctrl.pending ? "Mengirim…" : "Kirim tautan"}
            </Button>
          </Stack>
        </form>
      ) : null}

      {ctrl.hasToken && ctrl.tokenValid && !ctrl.checking && !ctrl.success ? (
        <form onSubmit={ctrl.confirmReset}>
          <Stack gap="sm">
            <Text c="dimmed">Masukkan kata sandi baru.</Text>
            <PasswordInput
              label="Kata sandi baru"
              description="Minimal 8 karakter, 1 huruf kapital, 1 angka"
              required
              value={ctrl.password}
              onChange={(ev) => ctrl.setPassword(ev.currentTarget.value)}
            />
            <ErrorAlert message={ctrl.error} code={ctrl.errorCode} transactionId={ctrl.transactionId} />
            <Button type="submit" disabled={ctrl.pending}>
              {ctrl.pending ? "Menyimpan…" : "Simpan kata sandi"}
            </Button>
          </Stack>
        </form>
      ) : null}

      {ctrl.hasToken && !ctrl.tokenValid && !ctrl.checking ? (
        <ErrorAlert message={ctrl.error} code={ctrl.errorCode} transactionId={ctrl.transactionId} />
      ) : null}

      {ctrl.success ? <Text>{ctrl.success}</Text> : null}
      {ctrl.success ? <AppLink href="/">Masuk dari beranda</AppLink> : null}
    </PageShell>
  );
}
