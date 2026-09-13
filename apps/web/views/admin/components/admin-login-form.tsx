"use client";

import { Button, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { ErrorAlert } from "@/components/error-alert";
import { PageShell } from "@/components/page-shell";
import { useAdminLogin } from "@/hooks/use-admin-login";

export function AdminLoginForm() {
  const ctrl = useAdminLogin();

  return (
    <PageShell title="Admin" size="xs">
      <Text c="dimmed">Masuk dengan username dan kata sandi admin.</Text>
      <form onSubmit={ctrl.submitLogin}>
        <Stack gap="sm">
          <TextInput
            label="Username"
            required
            value={ctrl.username}
            onChange={(ev) => ctrl.setUsername(ev.currentTarget.value)}
          />
          <PasswordInput
            label="Kata sandi"
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
            {ctrl.pending ? "Memproses…" : "Masuk"}
          </Button>
        </Stack>
      </form>
    </PageShell>
  );
}
