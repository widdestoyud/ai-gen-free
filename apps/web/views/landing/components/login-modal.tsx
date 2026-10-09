"use client";

import { Anchor, Button, Divider, Group, Modal, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { FormEvent, useEffect, useState } from "react";
import { initiateGoogleSignIn } from "@/lib/google-auth";
import { AppLink } from "@/components/app-link";
import { ErrorAlert } from "@/components/error-alert";
import { GoogleAuthButton } from "@/components/google-auth-button";

export function LoginModal({
  opened,
  onClose,
  onForgotPassword,
  onRegister,
  callbackUrl = "/app/generate",
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
  onRegister?: () => void;
  callbackUrl?: string;
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
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (error || errorCode) {
      setShake(true);
      const timer = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(timer);
    }
  }, [error, errorCode]);

  const handleSubmit = (e: FormEvent) => {
    if (pending || googleLoading) {
      e.preventDefault();
      return;
    }
    if (!email.trim() || !password) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
    onSubmit(e);
  };

  const handleGoogleSignIn = async () => {
    if (pending || googleLoading) return;
    setGoogleLoading(true);
    try {
      await initiateGoogleSignIn(callbackUrl);
    } catch {
      setGoogleLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (!pending && !googleLoading) onClose();
      }}
      closeOnClickOutside={!pending && !googleLoading}
      closeOnEscape={!pending && !googleLoading}
      withCloseButton={!pending && !googleLoading}
      title="Masuk"
      centered
      size="md"
      radius="md"
      padding="lg"
      classNames={{ content: shake ? "modal-shake" : "" }}
    >
      <Stack gap="md">
        <GoogleAuthButton
          loading={googleLoading}
          disabled={pending || googleLoading}
          onClick={handleGoogleSignIn}
        />
        <Divider label="atau masuk dengan email" labelPosition="center" my={2} />
      </Stack>
      <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
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
          <Group justify="space-between" align="center" mt={2} mb={2}>
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

            {onRegister ? (
              <Text size="xs" c="dimmed">
                Belum punya akun?{" "}
                <Anchor
                  component="button"
                  type="button"
                  size="xs"
                  c="blue.4"
                  fw={600}
                  disabled={pending}
                  onClick={() => {
                    if (!pending) onRegister();
                  }}
                  underline="hover"
                >
                  Daftar
                </Anchor>
              </Text>
            ) : null}
          </Group>
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
            {pending ? "Memproses…" : "Masuk"}
          </Button>
        </Stack>
      </form>
    </Modal>
  );
}
