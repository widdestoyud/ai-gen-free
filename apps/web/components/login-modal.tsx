"use client";

import { Button, Modal, PasswordInput, Stack, TextInput } from "@mantine/core";
import { FormEvent } from "react";
import { AppLink } from "./app-link";
import { ErrorAlert } from "./error-alert";

export function LoginModal({
  opened,
  onClose,
  email,
  password,
  onEmailChange,
  onPasswordChange,
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
  error?: string | null;
  errorCode?: string | null;
  transactionId?: string | null;
  pending: boolean;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title="Masuk" centered size="xs">
      <form onSubmit={onSubmit}>
        <Stack gap="sm">
          <TextInput
            label="Email"
            type="email"
            placeholder="nama@email.com"
            required
            value={email}
            onChange={(ev) => onEmailChange(ev.currentTarget.value)}
          />
          <PasswordInput
            label="Kata sandi"
            required
            value={password}
            onChange={(ev) => onPasswordChange(ev.currentTarget.value)}
          />
          <AppLink href="/auth/password">Lupa kata sandi?</AppLink>
          <ErrorAlert message={error} code={errorCode} transactionId={transactionId} />
          <Button type="submit" disabled={pending} fullWidth>
            {pending ? "Memproses…" : "Masuk"}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
