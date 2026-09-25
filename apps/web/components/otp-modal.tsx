"use client";

import { Alert, Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { FormEvent } from "react";
import { ErrorAlert } from "./error-alert";
import otpInput from "./otp-input.module.css";

export function OtpModal({
  opened,
  onClose,
  email,
  code,
  onCodeChange,
  error,
  errorCode,
  transactionId,
  pending,
  onSubmit,
  onResendOtp,
  resendPending = false,
  resendCooldown = 0,
  resendSuccessMessage = null,
}: {
  opened: boolean;
  onClose: () => void;
  email: string;
  code: string;
  onCodeChange: (code: string) => void;
  error?: string | null;
  errorCode?: string | null;
  transactionId?: string | null;
  pending: boolean;
  onSubmit: (e: FormEvent) => void;
  onResendOtp?: () => void;
  resendPending?: boolean;
  resendCooldown?: number;
  resendSuccessMessage?: string | null;
}) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Verifikasi Masuk"
      centered
      size="sm"
    >
      <Stack gap="xs" mb="md">
        <Text size="sm">
          Kami telah mengirimkan kode verifikasi 6 digit ke <strong>{email}</strong>.
        </Text>
        <Text c="dimmed" size="xs">
          Pastikan juga untuk memeriksa folder <strong>Spam / Promosi</strong> jika email tidak muncul di kotak masuk utama.
        </Text>
      </Stack>

      <form onSubmit={onSubmit}>
        <Stack gap="sm">
          <TextInput
            label="Kode OTP"
            placeholder="000000"
            inputMode="numeric"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(ev) => onCodeChange(ev.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
            classNames={{ input: otpInput.input }}
          />

          {resendSuccessMessage && (
            <Alert color="teal" variant="light" p="xs">
              <Text size="xs">{resendSuccessMessage}</Text>
            </Alert>
          )}

          <ErrorAlert message={error} code={errorCode} transactionId={transactionId} />

          <Button type="submit" disabled={pending || code.length !== 6} fullWidth>
            {pending ? "Memeriksa…" : "Masuk"}
          </Button>

          {onResendOtp && (
            <Group justify="center" mt="xs">
              <Button
                variant="subtle"
                size="xs"
                color="gray"
                onClick={onResendOtp}
                disabled={resendPending || resendCooldown > 0}
                loading={resendPending}
              >
                {resendCooldown > 0
                  ? `Kirim ulang dalam ${resendCooldown}s`
                  : "Belum menerima kode? Kirim Ulang OTP"}
              </Button>
            </Group>
          )}
        </Stack>
      </form>
    </Modal>
  );
}
