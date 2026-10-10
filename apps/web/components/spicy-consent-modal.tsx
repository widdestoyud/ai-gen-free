"use client";

import { useState } from "react";
import { Button, Checkbox, Group, Modal, Paper, ScrollArea, Stack, Text } from "@mantine/core";
import { ErrorAlert } from "./error-alert";
import { useI18n } from "@/lib/i18n";

export interface SpicyConsentModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm?: () => Promise<boolean | void>;
  loading?: boolean;
  error?: string | null;
  readOnly?: boolean;
}

export function SpicyConsentModal({
  opened,
  onClose,
  onConfirm,
  loading = false,
  error = null,
  readOnly = false,
}: SpicyConsentModalProps) {
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
    await onConfirm?.();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={readOnly ? t("spicy.title_readonly") : t("spicy.title_active")}
      centered
      size="md"
      closeOnClickOutside={!loading}
      closeOnEscape={!loading}
    >
      <Stack gap="md">
        <Paper p="sm" withBorder radius="sm" bg="var(--mantine-color-dark-8, #1a1b1e)">
          <ScrollArea.Autosize mah={260} type="scroll">
            <Stack gap="xs">
              <Text size="sm" fw={600} c="red.4">
                {t("spicy.warning_title")}
              </Text>
              <Text size="xs" c="dimmed">
                <strong>{t("spicy.rule_1_title")}</strong> {t("spicy.rule_1_desc")}
              </Text>
              <Text size="xs" c="dimmed">
                <strong>{t("spicy.rule_2_title")}</strong> {t("spicy.rule_2_desc")}
              </Text>
              <Text size="xs" c="dimmed">
                <strong>{t("spicy.rule_3_title")}</strong> {t("spicy.rule_3_desc")}
              </Text>
              <Text size="xs" c="dimmed">
                <strong>{t("spicy.rule_4_title")}</strong> {t("spicy.rule_4_desc")}
              </Text>
            </Stack>
          </ScrollArea.Autosize>
        </Paper>

        {!readOnly ? (
          <>
            <Checkbox
              checked={agreed}
              onChange={(e) => setAgreed(e.currentTarget.checked)}
              label={t("spicy.checkbox_label")}
              size="xs"
              disabled={loading}
              color="red"
            />

            <ErrorAlert message={error} />

            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={handleClose} disabled={loading} size="sm">
                {t("spicy.btn_cancel")}
              </Button>
              <Button
                color="red"
                onClick={handleConfirm}
                disabled={!agreed || loading}
                loading={loading}
                size="sm"
              >
                {t("spicy.btn_confirm")}
              </Button>
            </Group>
          </>
        ) : (
          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose} size="sm">
              {t("spicy.btn_close")}
            </Button>
          </Group>
        )}
      </Stack>
    </Modal>
  );
}
