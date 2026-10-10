"use client";

import { Anchor, Button, Checkbox, Divider, Group, Modal, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { initiateGoogleSignIn } from "@/lib/google-auth";
import { ErrorAlert } from "@/components/error-alert";
import { GoogleAuthButton } from "@/components/google-auth-button";

export function RegisterModal({
  opened,
  onClose,
  onLogin,
  callbackUrl = "/app/generate",
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
  onLogin?: () => void;
  callbackUrl?: string;
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
  const { t } = useI18n("auth");
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
    if (!email.trim() || !password || !termsAccepted) {
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
      title={t("register.modal_title")}
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
          showConsentText={true}
          onClick={handleGoogleSignIn}
        />
        <Divider label={t("register.or_email")} labelPosition="center" my={2} />
      </Stack>
      <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
        <Stack gap="sm">
          <TextInput
            label={t("register.email_label")}
            type="email"
            placeholder={t("register.email_placeholder")}
            required
            disabled={pending}
            value={email}
            onChange={(ev) => onEmailChange(ev.currentTarget.value)}
          />
          <PasswordInput
            label={t("register.password_label")}
            description={t("register.password_hint")}
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
                {t("register.terms_prefix")}
                <Anchor
                  component={Link}
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  size="xs"
                  c="blue.4"
                  underline="hover"
                >
                  {t("register.terms_terms")}
                </Anchor>
                {t("register.terms_and")}
                <Anchor
                  component={Link}
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  size="xs"
                  c="blue.4"
                  underline="hover"
                >
                  {t("register.terms_privacy")}
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
            size="md"
          >
            {pending ? t("register.processing") : t("register.btn_submit")}
          </Button>

          {onLogin ? (
            <Group justify="center" mt={4}>
              <Text size="xs" c="dimmed">
                {t("register.has_account")}{" "}
                <Anchor
                  component="button"
                  type="button"
                  size="xs"
                  c="blue.4"
                  fw={600}
                  disabled={pending}
                  onClick={() => {
                    if (!pending) onLogin();
                  }}
                  underline="hover"
                >
                  {t("register.link_login")}
                </Anchor>
              </Text>
            </Group>
          ) : null}
        </Stack>
      </form>
    </Modal>
  );
}
