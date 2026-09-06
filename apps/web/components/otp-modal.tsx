"use client";

import { Button, Modal, Stack, Text, TextInput } from "@mantine/core";
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
}) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Kode OTP"
      centered
      size="xs"
    >
      <Text c="dimmed" size="sm" mb="md">
        Masukkan 6 digit kode yang telah dikirim ke <strong>{email}</strong>.
      </Text>
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
          <ErrorAlert message={error} code={errorCode} transactionId={transactionId} />
          <Button type="submit" disabled={pending || code.length !== 6} fullWidth>
            {pending ? "Memeriksa…" : "Masuk"}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
