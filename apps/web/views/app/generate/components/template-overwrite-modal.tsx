"use client";

import { useEffect, useState } from "react";
import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useI18n } from "@/lib/i18n";

export interface TemplateOverwriteModalProps {
  opened: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onAfterConfirm?: () => void;
}

/**
 * Modal konfirmasi saat pengguna memilih template baru sementara prompt atau referensi sudah diubah manual.
 */
export function TemplateOverwriteModal({
  opened,
  onCancel,
  onConfirm,
  onAfterConfirm,
}: TemplateOverwriteModalProps) {
  const { t } = useI18n("generate");
  const [confirmedClose, setConfirmedClose] = useState(false);

  useEffect(() => {
    if (opened) {
      setConfirmedClose(false);
    }
  }, [opened]);

  const handleCancel = () => {
    setConfirmedClose(false);
    onCancel();
  };

  const handleConfirm = () => {
    setConfirmedClose(true);
    onConfirm();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleCancel}
      title={t("templates.overwrite_title")}
      centered
      size="sm"
      radius="lg"
      returnFocus={!confirmedClose}
      onExitTransitionEnd={() => {
        if (confirmedClose) {
          onAfterConfirm?.();
        }
      }}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {t("templates.overwrite_body")}
        </Text>

        <Group justify="flex-end" gap="sm">
          <Button type="button" variant="default" size="sm" onClick={handleCancel}>
            {t("templates.overwrite_cancel")}
          </Button>
          <Button type="button" color="blue" size="sm" onClick={handleConfirm}>
            {t("templates.overwrite_confirm")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
