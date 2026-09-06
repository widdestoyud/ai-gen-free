"use client";

import { Button, Stack, Text, TextInput } from "@mantine/core";
import { ErrorAlert } from "@/components/error-alert";
import { OtpModal } from "@/components/otp-modal";
import { PageShell } from "@/components/page-shell";
import { useAdminLogin } from "@/hooks/use-admin-login";

export default function AdminLoginPage() {
  const ctrl = useAdminLogin();

  return (
    <PageShell title="Admin" size="xs">
      <Text c="dimmed">Bukan halaman pelanggan. OTP hanya untuk akun admin.</Text>
      <form onSubmit={ctrl.requestCode}>
        <Stack gap="sm">
          <TextInput
            label="Email admin"
            type="email"
            placeholder="admin@email.com"
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
            {ctrl.pending ? "Memproses…" : "Kirim kode"}
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
