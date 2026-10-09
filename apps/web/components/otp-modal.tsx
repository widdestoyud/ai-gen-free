"use client";

import { Alert, Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { FormEvent, useEffect, useState } from "react";
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
  const [shake, setShake] = useState(false);
  const [submittedCode, setSubmittedCode] = useState("");

  useEffect(() => {
    if (error || errorCode) {
      setShake(true);
      setSubmittedCode("");
      const timer = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [error, errorCode]);

  useEffect(() => {
    const clean = code.trim();
    if (clean.length < 6) {
      setSubmittedCode("");
    } else if (clean.length === 6 && !pending && clean !== submittedCode) {
      setSubmittedCode(clean);
      onSubmit({ preventDefault: () => {} } as FormEvent);
    }
  }, [code, pending, submittedCode, onSubmit]);

  const handleSubmit = (e: FormEvent) => {
    if (pending) {
      e.preventDefault();
      return;
    }
    if (code.trim().length !== 6) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
    onSubmit(e);
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (!pending) onClose();
      }}
      closeOnClickOutside={!pending}
      closeOnEscape={!pending}
      withCloseButton={!pending}
      title="Verifikasi Masuk"
      centered
      size="md"
      radius="md"
      padding="lg"
      classNames={{ content: shake ? "modal-shake" : "" }}
    >
      <Stack gap="xs" mb="md">
        <Text size="sm">
          Kami telah mengirimkan kode verifikasi 6 digit ke <strong>{email}</strong>.
        </Text>
        <Text c="dimmed" size="xs">
          Pastikan juga untuk memeriksa folder <strong>Spam / Promosi</strong> jika email tidak muncul di kotak masuk utama.
        </Text>
      </Stack>

      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <TextInput
            label="Kode OTP"
            placeholder="000000"
            inputMode="numeric"
            maxLength={6}
            required
            autoFocus
            disabled={pending}
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

          <Button
            type="submit"
            loading={pending}
            disabled={pending || code.length !== 6}
            variant="gradient"
            gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
            fullWidth
            size="md"
          >
            {pending ? "Memeriksa…" : "Masuk"}
          </Button>

          {onResendOtp && (
            <Group justify="center" mt="xs">
              <Button
                variant="subtle"
                size="xs"
                color="gray"
                onClick={onResendOtp}
                disabled={pending || resendPending || resendCooldown > 0}
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
