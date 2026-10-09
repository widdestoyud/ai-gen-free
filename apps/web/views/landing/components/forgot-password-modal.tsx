"use client";

import { Anchor, Button, Group, Modal, Paper, Stack, Text, TextInput } from "@mantine/core";
import { FormEvent, useEffect, useState } from "react";
import { ErrorAlert } from "@/components/error-alert";

export function ForgotPasswordModal({
  opened,
  onClose,
  onBackToLogin,
  email,
  onEmailChange,
  success,
  error,
  errorCode,
  transactionId,
  pending,
  onSubmit,
}: {
  opened: boolean;
  onClose: () => void;
  onBackToLogin?: () => void;
  email: string;
  onEmailChange: (value: string) => void;
  success?: string | null;
  error?: string | null;
  errorCode?: string | null;
  transactionId?: string | null;
  pending: boolean;
  onSubmit: (e: FormEvent) => void;
}) {
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (error || errorCode) {
      setShake(true);
      const timer = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [error, errorCode]);

  const handleSubmit = (e: FormEvent) => {
    if (pending) {
      e.preventDefault();
      return;
    }
    if (!email.trim()) {
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
      title="Lupa Kata Sandi"
      centered
      size="md"
      radius="md"
      padding="lg"
      classNames={{ content: shake ? "modal-shake" : "" }}
    >
      {success ? (
        <Stack gap="md">
          <Paper p="md" withBorder radius="md" bg="rgba(16, 185, 129, 0.08)" style={{ borderColor: "rgba(16, 185, 129, 0.25)" }}>
            <Group gap="xs" align="flex-start" wrap="nowrap">
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <Text size="sm" fw={600} c="green.4" mb={4}>
                  Tautan Berhasil Dikirim
                </Text>
                <Text size="xs" c="gray.3" lh={1.5}>
                  {success} Silakan periksa kotak masuk atau folder spam email Anda.
                </Text>
              </div>
            </Group>
          </Paper>

          {onBackToLogin ? (
            <Button
              variant="gradient"
              gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
              fullWidth
              onClick={() => {
                onClose();
                onBackToLogin();
              }}
            >
              Kembali ke Masuk
            </Button>
          ) : (
            <Button fullWidth onClick={onClose}>
              Tutup
            </Button>
          )}
        </Stack>
      ) : (
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <Text size="xs" c="dimmed">
              Masukkan alamat email akun Anda. Kami akan mengirimkan tautan untuk mengatur ulang kata sandi.
            </Text>
            <TextInput
              label="Email"
              type="email"
              placeholder="nama@email.com"
              required
              value={email}
              onChange={(ev) => onEmailChange(ev.currentTarget.value)}
              disabled={pending}
            />
            <ErrorAlert message={error} code={errorCode} transactionId={transactionId} />
            <Button
              type="submit"
              loading={pending}
              disabled={pending}
              variant="gradient"
              gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
              fullWidth
              size="md"
            >
              {pending ? "Mengirim Tautan…" : "Kirim Tautan Reset"}
            </Button>

            {onBackToLogin && (
              <Group justify="center" mt="xs">
                <Anchor
                  component="button"
                  type="button"
                  size="xs"
                  c="dimmed"
                  disabled={pending}
                  onClick={() => {
                    if (!pending) {
                      onClose();
                      onBackToLogin();
                    }
                  }}
                  style={{ cursor: pending ? "not-allowed" : "pointer" }}
                >
                  ← Kembali ke Masuk
                </Anchor>
              </Group>
            )}
          </Stack>
        </form>
      )}
    </Modal>
  );
}
