"use client";

import { Anchor, Button, Group, Modal, Paper, Stack, Text, TextInput } from "@mantine/core";
import { FormEvent, useEffect, useState } from "react";
import { ErrorAlert } from "@/components/error-alert";
import { useI18n } from "@/lib/i18n";

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
  const t = useI18n("auth");
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
      title={t("forgot_password.modal_title")}
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
                  {t("forgot_password.success_title")}
                </Text>
                <Text size="xs" c="gray.3" lh={1.5}>
                  {t("forgot_password.success_message", { message: success })}
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
              {t("forgot_password.btn_back_login")}
            </Button>
          ) : (
            <Button fullWidth onClick={onClose}>
              {t("forgot_password.btn_close")}
            </Button>
          )}
        </Stack>
      ) : (
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <Text size="xs" c="dimmed">
              {t("forgot_password.instruction")}
            </Text>
            <TextInput
              label={t("forgot_password.email_label")}
              type="email"
              placeholder={t("forgot_password.email_placeholder")}
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
              {pending ? t("forgot_password.btn_sending") : t("forgot_password.btn_submit")}
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
                  {t("forgot_password.back_to_login_arrow")}
                </Anchor>
              </Group>
            )}
          </Stack>
        </form>
      )}
    </Modal>
  );
}
