"use client";

import { Button, Stack, Text, TextInput } from "@mantine/core";
import { ErrorAlert } from "@/components/error-alert";
import { OtpModal } from "@/components/otp-modal";
import { PageShell } from "@/components/page-shell";
import { useLogin } from "@/hooks/use-login";

export default function LoginPage() {
  const ctrl = useLogin();

  return (
    <PageShell title="Masuk" size="xs">
      <Text c="dimmed">Kami kirim kode 6 digit ke email kamu.</Text>
      <form onSubmit={ctrl.requestCode}>
        <Stack gap="sm">
          <TextInput
            label="Email"
            type="email"
            placeholder="nama@email.com"
            required
            value={ctrl.email}
            onChange={(ev) => ctrl.setEmail(ev.currentTarget.value)}
          />
          <ErrorAlert
            message={ctrl.error}
            code={ctrl.errorCode}
            transactionId={ctrl.transactionId}
          />
          <Button type="submit" disabled={ctrl.pending}>
            {ctrl.pending ? "Mengirim…" : "Kirim kode"}
          </Button>
        </Stack>
      </form>

      <OtpModal
        opened={ctrl.otpModalOpened}
        onClose={ctrl.closeOtpModal}
        email={ctrl.email}
        code={ctrl.code}
        onCodeChange={ctrl.setCode}
        error={ctrl.error}
        errorCode={ctrl.errorCode}
        transactionId={ctrl.transactionId}
        pending={ctrl.pending}
        onSubmit={ctrl.verifyCode}
      />
    </PageShell>
  );
}
