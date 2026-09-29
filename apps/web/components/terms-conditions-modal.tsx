"use client";

import { Button, Group, Modal, Paper, ScrollArea, Stack, Text } from "@mantine/core";

export interface TermsConditionsModalProps {
  opened: boolean;
  onClose: () => void;
}

export function TermsConditionsModal({ opened, onClose }: TermsConditionsModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Syarat & Ketentuan Layanan"
      centered
      size="lg"
    >
      <Stack gap="md">
        <Paper p="md" withBorder radius="sm" bg="var(--mantine-color-dark-8, #1a1b1e)">
          <ScrollArea.Autosize mah={360} type="scroll">
            <Stack gap="sm">
              <Text size="sm" fw={600}>
                Ketentuan Penggunaan Platform satulabs.id
              </Text>
              <Text size="xs" c="dimmed">
                Selamat datang di platform satulabs.id. Dengan mengakses dan menggunakan layanan kami, Anda menyetujui untuk terikat oleh Syarat dan Ketentuan berikut:
              </Text>
              
              <Text size="xs" fw={600} mt="xs">
                1. Penggunaan Layanan
              </Text>
              <Text size="xs" c="dimmed">
                Layanan ini menyediakan fasilitas pembuatan konten berbasis kecerdasan buatan (AI) untuk keperluan pribadi dan komersial yang sah sesuai dengan peraturan perundang-undangan Republik Indonesia.
              </Text>

              <Text size="xs" fw={600} mt="xs">
                2. Akun & Keamanan
              </Text>
              <Text size="xs" c="dimmed">
                Setiap pengguna bertanggung jawab penuh atas kerahasiaan informasi akun, keamanan email, dan aktivitas yang terjadi di bawah akun mereka. Satu sesi login aktif diterapkan untuk menjaga keamanan akun.
              </Text>

              <Text size="xs" fw={600} mt="xs">
                3. Sistem Sparks & Generasi
              </Text>
              <Text size="xs" c="dimmed">
                Generasi media menggunakan saldo Sparks. Sparks diperoleh melalui pembelian paket dengan pembayaran transfer manual terkurasi dan tidak memiliki masa kedaluwarsa. Sparks yang telah dibeli atau digunakan tidak dapat diuangkan kembali (non-refundable).
              </Text>

              <Text size="xs" fw={600} mt="xs">
                4. Pembatasan Konten & Retensi Media
              </Text>
              <Text size="xs" c="dimmed">
                Dilarang menggunakan platform untuk memproduksi atau mengunggah konten yang melanggar hukum, eksploitasi seksual anak, kekerasan, atau pelanggaran hak cipta. Hasil generasi dan unggahan media disimpan selama 14 hari sebelum dihapus otomatis demi efisiensi penyimpanan, sementara riwayat teks prompt tetap disimpan.
              </Text>

              <Text size="xs" fw={600} mt="xs">
                5. Batasan Tanggung Jawab
              </Text>
              <Text size="xs" c="dimmed">
                Platform disediakan sebagaimana adanya (&quot;as is&quot;). Kami berhak membatasi, menangguhkan, atau menghentikan akses akun yang melanggar ketentuan ini sewaktu-waktu. Untuk ketentuan lengkap, silakan kunjungi halaman Syarat &amp; Ketentuan.
              </Text>
            </Stack>
          </ScrollArea.Autosize>
        </Paper>

        <Group justify="flex-end">
          <Button
            variant="gradient"
            gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
            onClick={onClose}
            size="sm"
          >
            Setuju
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
