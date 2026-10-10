"use client";

import { Button, Group, Modal, Text } from "@mantine/core";
import { ErrorAlert } from "./error-alert";
import { useI18n } from "@/lib/i18n";

export function LogoutConfirmModal({
  opened,
  onClose,
  onConfirm,
  pending,
  error,
}: {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
  error?: string | null;
}) {
  const t = useI18n("modals");

  return (
    <Modal opened={opened} onClose={onClose} title={t("logout.title")} centered size="xs">
      <Text mb="md">{t("logout.message")}</Text>
      <ErrorAlert message={error} />
      <Group justify="flex-end" gap="sm">
        <Button type="button" variant="default" onClick={onClose} disabled={pending}>
          {t("logout.btn_cancel")}
        </Button>
        <Button type="button" color="red" onClick={onConfirm} disabled={pending}>
          {pending ? t("logout.btn_confirming") : t("logout.btn_confirm")}
        </Button>
      </Group>
    </Modal>
  );
}
