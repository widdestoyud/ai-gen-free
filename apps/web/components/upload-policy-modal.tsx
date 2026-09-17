"use client";

import { useState } from "react";
import { Button, Checkbox, Group, Modal, Paper, ScrollArea, Stack, Text } from "@mantine/core";
import { ErrorAlert } from "./error-alert";

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
      title="Kebijakan Unggah Media"
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
                Ketentuan &amp; Tanggung Jawab Unggah Berkas:
              </Text>
              <Text size="xs" c="dimmed">
                1. <strong>Kepemilikan Hak Cipta:</strong> Anda menyatakan bahwa berkas gambar yang Anda unggah adalah milik Anda sendiri atau Anda memiliki izin sah dari pemilik hak cipta untuk menggunakannya.
              </Text>
              <Text size="xs" c="dimmed">
                2. <strong>Konten Terlarang:</strong> Dilarang keras mengunggah materi yang melanggar hukum, pornografi anak, eksploitasi, kekerasan ekstrem, ujaran kebencian, atau konten yang melanggar norma privasi orang lain tanpa persetujuan.
              </Text>
              <Text size="xs" c="dimmed">
                3. <strong>Penyimpanan &amp; Retensi:</strong> Berkas unggahan akan disimpan untuk kebutuhan pemrosesan generasi AI dan tunduk pada kebijakan retensi platform.
              </Text>
              <Text size="xs" c="dimmed">
                4. <strong>Persetujuan Permanen:</strong> Persetujuan atas kebijakan ini bersifat permanen untuk akun Anda dan diperlukan sebelum Anda dapat menggunakan fitur unggah atau memilih media sebagai referensi generate.
              </Text>
            </Stack>
          </ScrollArea.Autosize>
        </Paper>

        {!readOnly ? (
          <>
            <Checkbox
              checked={agreed}
              onChange={(e) => setAgreed(e.currentTarget.checked)}
              label="Saya telah membaca, memahami, dan menyetujui seluruh ketentuan kebijakan unggah media di atas."
              size="xs"
              disabled={loading}
            />

            <ErrorAlert message={error} />

            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={handleClose} disabled={loading} size="sm">
                Batal
              </Button>
              <Button
                color="blue"
                onClick={handleConfirm}
                disabled={!agreed || loading}
                loading={loading}
                size="sm"
              >
                Setuju &amp; Lanjutkan
              </Button>
            </Group>
          </>
        ) : (
          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose} size="sm">
              Tutup
            </Button>
          </Group>
        )}
      </Stack>
    </Modal>
  );
}
