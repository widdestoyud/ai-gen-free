"use client";

import { useState } from "react";
import { Button, Checkbox, Group, Modal, Paper, ScrollArea, Stack, Text } from "@mantine/core";
import { ErrorAlert } from "./error-alert";

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
      title={readOnly ? "Ketentuan Spicy Mode" : "Aktivasi Spicy Mode"}
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
                Peringatan Batasan Usia &amp; Konten (18+):
              </Text>
              <Text size="xs" c="dimmed">
                1. <strong>Batasan Usia:</strong> Fitur Spicy Mode hanya diperuntukkan bagi pengguna yang telah berusia 18 (delapan belas) tahun ke atas dan telah melengkapi data tanggal lahir pada profil.
              </Text>
              <Text size="xs" c="dimmed">
                2. <strong>Tanggung Jawab Pengguna:</strong> Anda bertanggung jawab penuh atas seluruh teks prompt dan gambar/video yang dihasilkan selama mode ini aktif.
              </Text>
              <Text size="xs" c="dimmed">
                3. <strong>Larangan Mutlak:</strong> Dilarang keras memproduksi konten yang melibatkan anak di bawah umur (CSAM), kekerasan non-konsensual, atau konten ilegal lainnya. Pelanggaran akan berakibat pemblokiran akun permanen tanpa pengembalian dana.
              </Text>
              <Text size="xs" c="dimmed">
                4. <strong>Fleksibilitas Pengaturan:</strong> Persetujuan ini dicatat pada akun Anda dan Anda dapat mengaktifkan atau menonaktifkan Spicy Mode sewaktu-waktu melalui halaman Pengaturan Profil.
              </Text>
            </Stack>
          </ScrollArea.Autosize>
        </Paper>

        {!readOnly ? (
          <>
            <Checkbox
              checked={agreed}
              onChange={(e) => setAgreed(e.currentTarget.checked)}
              label="Saya menyatakan telah berusia 18+ tahun dan menyetujui seluruh ketentuan aktivasi Spicy Mode."
              size="xs"
              disabled={loading}
              color="red"
            />

            <ErrorAlert message={error} />

            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={handleClose} disabled={loading} size="sm">
                Batal
              </Button>
              <Button
                color="red"
                onClick={handleConfirm}
                disabled={!agreed || loading}
                loading={loading}
                size="sm"
              >
                Setuju &amp; Aktifkan
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
