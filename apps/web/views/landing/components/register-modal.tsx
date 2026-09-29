"use client";

import { Anchor, Button, Checkbox, Modal, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ErrorAlert } from "@/components/error-alert";

export function RegisterModal({
  opened,
  onClose,
  email,
  password,
  onEmailChange,
  onPasswordChange,
  termsAccepted,
  onTermsAcceptedChange,
  success,
  error,
  errorCode,
  transactionId,
  pending,
  onSubmit,
}: {
  opened: boolean;
  onClose: () => void;
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  termsAccepted: boolean;
  onTermsAcceptedChange: (value: boolean) => void;
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
    if (!email.trim() || !password || !termsAccepted) {
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
      title="Daftar Akun"
      centered
      size="sm"
      classNames={{ content: shake ? "modal-shake" : "" }}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <TextInput
            label="Email"
            type="email"
            placeholder="nama@gmail.com"
            required
            disabled={pending}
            value={email}
            onChange={(ev) => onEmailChange(ev.currentTarget.value)}
          />
          <PasswordInput
            label="Kata sandi"
            description="Minimal 8 karakter, 1 huruf kapital, 1 angka"
            required
            disabled={pending}
            value={password}
            onChange={(ev) => onPasswordChange(ev.currentTarget.value)}
          />

          <Checkbox
            checked={termsAccepted}
            disabled={pending}
            onChange={(ev) => onTermsAcceptedChange(ev.currentTarget.checked)}
            label={
              <Text size="xs" c="gray.3">
                Saya berusia 18+ dan menyetujui{" "}
                <Anchor
                  component={Link}
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  size="xs"
                  c="blue.4"
                  underline="hover"
                >
                  Ketentuan
                </Anchor>{" "}
                &amp;{" "}
                <Anchor
                  component={Link}
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  size="xs"
                  c="blue.4"
                  underline="hover"
                >
                  Kebijakan Privasi
                </Anchor>
              </Text>
            }
          />

          {success ? <Text c="green" size="xs">{success}</Text> : null}
          <ErrorAlert message={error} code={errorCode} transactionId={transactionId} />

          <Button
            type="submit"
            loading={pending}
            disabled={pending || !termsAccepted}
            variant="gradient"
            gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
            fullWidth
          >
            {pending ? "Mendaftar…" : "Daftar"}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
