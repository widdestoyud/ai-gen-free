"use client";

import { Anchor, Button, Modal, PasswordInput, Stack, TextInput } from "@mantine/core";
import { FormEvent, useEffect, useState } from "react";
import { AppLink } from "@/components/app-link";
import { ErrorAlert } from "@/components/error-alert";

export function LoginModal({
  opened,
  onClose,
  onForgotPassword,
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
  onForgotPassword?: () => void;
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
    if (!email.trim() || !password) {
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
      title="Masuk"
      centered
      size="xs"
      classNames={{ content: shake ? "modal-shake" : "" }}
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          <TextInput
            label="Email"
            type="email"
            placeholder="nama@email.com"
            required
            disabled={pending}
            value={email}
            onChange={(ev) => onEmailChange(ev.currentTarget.value)}
          />
          <PasswordInput
            label="Kata sandi"
            required
            disabled={pending}
            value={password}
            onChange={(ev) => onPasswordChange(ev.currentTarget.value)}
          />
          {onForgotPassword ? (
            <Anchor
              component="button"
              type="button"
              size="xs"
              c="dimmed"
              disabled={pending}
              onClick={() => {
                if (!pending) onForgotPassword();
              }}
              style={{ textAlign: "left", cursor: pending ? "not-allowed" : "pointer", textDecoration: "none" }}
            >
              Lupa kata sandi?
            </Anchor>
          ) : (
            <AppLink href="/auth/password">Lupa kata sandi?</AppLink>
          )}
          <ErrorAlert message={error} code={errorCode} transactionId={transactionId} />
          <Button
            type="submit"
            loading={pending}
            disabled={pending}
            variant="gradient"
            gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
            fullWidth
          >
            {pending ? "Memproses…" : "Masuk"}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
