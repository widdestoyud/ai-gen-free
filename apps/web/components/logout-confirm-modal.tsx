"use client";

import { Button, Group, Modal, Text } from "@mantine/core";
import { ErrorAlert } from "./error-alert";

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
  return (
    <Modal opened={opened} onClose={onClose} title="Keluar" centered size="xs">
      <Text mb="md">Anda yakin ingin keluar dari akun?</Text>
      <ErrorAlert message={error} />
      <Group justify="flex-end" gap="sm">
        <Button type="button" variant="default" onClick={onClose} disabled={pending}>
          Batal
        </Button>
        <Button type="button" color="red" onClick={onConfirm} disabled={pending}>
          {pending ? "Keluar…" : "Keluar"}
        </Button>
      </Group>
    </Modal>
  );
}
