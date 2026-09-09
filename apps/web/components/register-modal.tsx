"use client";

import { Button, Modal, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { FormEvent } from "react";
import { ErrorAlert } from "./error-alert";

export function RegisterModal({
  opened,
  onClose,
  email,
  password,
  onEmailChange,
  onPasswordChange,
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
  success?: string | null;
  error?: string | null;
  errorCode?: string | null;
  transactionId?: string | null;
  pending: boolean;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title="Daftar" centered size="xs">
      <form onSubmit={onSubmit}>
        <Stack gap="sm">
          <TextInput
            label="Email"
            type="email"
            placeholder="nama@gmail.com"
            required
            value={email}
            onChange={(ev) => onEmailChange(ev.currentTarget.value)}
          />
          <PasswordInput
            label="Kata sandi"
            description="Minimal 8 karakter, 1 huruf kapital, 1 angka"
            required
            value={password}
            onChange={(ev) => onPasswordChange(ev.currentTarget.value)}
          />
          {success ? <Text c="green">{success}</Text> : null}
          <ErrorAlert message={error} code={errorCode} transactionId={transactionId} />
          <Button type="submit" disabled={pending} fullWidth>
            {pending ? "Mendaftar…" : "Daftar"}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
