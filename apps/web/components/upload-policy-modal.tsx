"use client";

import { useState } from "react";
import { Button, Checkbox, Group, Modal, Paper, ScrollArea, Stack, Text } from "@mantine/core";
import { ErrorAlert } from "./error-alert";
import { useI18n } from "@/lib/i18n";

export interface UploadPolicyModalProps {
  opened: boolean;
  onClose: () => void;
  onAccept?: () => Promise<boolean | void>;
  loading?: boolean;
  error?: string | null;
  readOnly?: boolean;
}

export function UploadPolicyModal({
  opened,
  onClose,
  onAccept,
  loading = false,
  error = null,
  readOnly = false,
}: UploadPolicyModalProps) {
  const t = useI18n("modals");
  const [agreed, setAgreed] = useState(false);

  const handleClose = () => {
    if (!loading) {
      setAgreed(false);
      onClose();
    }
  };

  const handleConfirm = async () => {
    if (readOnly) {
      handleClose();
      return;
    }
    if (!agreed || loading) return;
    await onAccept?.();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t("upload_policy.title")}
      centered
      size="md"
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
    >
      <Stack gap="md">
        <Paper p="sm" withBorder radius="sm" bg="var(--mantine-color-dark-8, #1a1b1e)">
          <ScrollArea.Autosize mah={260} type="scroll">
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                {t("upload_policy.heading")}
              </Text>
              <Text size="xs" c="dimmed">
                <strong>{t("upload_policy.rule_1_title")}</strong> {t("upload_policy.rule_1_desc")}
              </Text>
              <Text size="xs" c="dimmed">
                <strong>{t("upload_policy.rule_2_title")}</strong> {t("upload_policy.rule_2_desc")}
              </Text>
              <Text size="xs" c="dimmed">
                <strong>{t("upload_policy.rule_3_title")}</strong> {t("upload_policy.rule_3_desc")}
              </Text>
              <Text size="xs" c="dimmed">
                <strong>{t("upload_policy.rule_4_title")}</strong> {t("upload_policy.rule_4_desc")}
              </Text>
            </Stack>
          </ScrollArea.Autosize>
        </Paper>

        {!readOnly ? (
          <>
            <Checkbox
              checked={agreed}
              onChange={(e) => setAgreed(e.currentTarget.checked)}
              label={t("upload_policy.checkbox_label")}
              size="xs"
              disabled={loading}
            />

            <ErrorAlert message={error} />

            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={handleClose} disabled={loading} size="sm">
                {t("upload_policy.btn_cancel")}
              </Button>
              <Button
                variant="gradient"
                gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
                onClick={handleConfirm}
                disabled={!agreed || loading}
                loading={loading}
                size="sm"
              >
                {t("upload_policy.btn_confirm")}
              </Button>
            </Group>
          </>
        ) : (
          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose} size="sm">
              {t("upload_policy.btn_close")}
            </Button>
          </Group>
        )}
      </Stack>
    </Modal>
  );
}
