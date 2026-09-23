"use client";

import { Container, Stack, Title, Text, Paper, Button, Group, Divider, Badge } from "@mantine/core";
import Link from "next/link";

export function PrivacyPageView() {
  return (
    <Container size="md" py={60}>
      <Stack gap="xl">
        <Group justify="space-between" align="center">
          <Button
            component={Link}
            href="/"
            variant="subtle"
            color="gray"
            size="sm"
            leftSection={
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            }
          >
            Kembali ke Beranda
          </Button>
          <Badge variant="outline" color="teal">
            Diperbarui: September 2026
          </Badge>
        </Group>

        <div>
          <Title order={1} fz={{ base: "1.8rem", sm: "2.4rem" }} fw={900} mb="xs">
            Kebijakan Privasi
          </Title>
          <Text c="dimmed" size="sm">
            Privasi dan kerahasiaan data Anda adalah prioritas utama kami di{" "}
            <strong>ai-gen-free</strong>.
          </Text>
        </div>

        <Divider />

        <Paper p="xl" withBorder radius="md" bg="var(--mantine-color-dark-8, #14171f)">
          <Stack gap="lg">
            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                1. Prinsip Dasar Privasi: Karyamu Bersifat Privat
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                Berbeda dengan banyak layanan generasi AI yang secara otomatis menyebarkan hasil
                karya ke galeri publik atau media sosial, seluruh media (gambar dan video) yang Anda
                hasilkan di <strong>ai-gen-free</strong> tersimpan secara privat di akun pribadi Anda.
                Karya Anda <strong>bukan konsumsi publik</strong> dan tidak dapat diakses oleh pengguna
                lain kecuali Anda sendiri yang mengunduh dan membagikannya.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                2. Data yang Kami Kumpulkan
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                Kami hanya mengumpulkan data yang benar-benar esensial untuk pengoperasian platform:
              </Text>
              <Stack gap="xs" mt="xs" pl="md">
                <Text size="sm" c="dimmed">
                  • <strong>Data Identitas &amp; Autentikasi:</strong> Alamat email resmi, hash kata
                  sandi yang terenkripsi (bukan teks polos), data verifikasi OTP, dan riwayat sesi.
                </Text>
                <Text size="sm" c="dimmed">
                  • <strong>Data Transaksi &amp; Poin:</strong> Riwayat ledger mutasi poin, holding,
                  dan invoice pembayaran. Kami tidak pernah menyimpan nomor kartu kredit atau detail
                  finansial sensitif di server kami.
                </Text>
                <Text size="sm" c="dimmed">
                  • <strong>Metadata Operasional:</strong> Prompt teks, parameter rasio aspek/durasi,
                  dan log kegagalan teknis semata-mata untuk memproses antrian pekerjaan (*job*).
                </Text>
              </Stack>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                3. Penggunaan Data &amp; Larangan Pelatihan AI Pihak Ketiga
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                Kami <strong>tidak menjual data pribadi Anda</strong> kepada pihak ketiga dan{" "}
                <strong>tidak menggunakan karya atau prompt kreatif Anda</strong> untuk melatih
                model kecerdasan buatan (*AI training*) publik tanpa persetujuan eksplisit Anda.
                Data Anda digunakan semata-mata untuk merender permintaan generasi dan menjaga
                kelancaran sesi.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                4. Retensi &amp; Siklus Hidup Media (TTL 14 Hari)
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                File gambar dan video hasil generasi disimpan pada penyimpanan awan terenkripsi
                dengan siklus hidup waktu simpan (*Time-to-Live*) selama{" "}
                <strong>14 (empat belas) hari</strong>. Setelah melewati kurun waktu tersebut, file
                akan dihapus secara permanen dari server penyimpanan demi efisiensi dan keamanan
                privasi data Anda.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                5. Kepatuhan Undang-Undang Pelindungan Data Pribadi (UU PDP)
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                Sesuai dengan amanat Undang-Undang Republik Indonesia No. 27 Tahun 2022 tentang
                Pelindungan Data Pribadi (UU PDP), Anda memiliki hak untuk:
              </Text>
              <Stack gap="xs" mt="xs" pl="md">
                <Text size="sm" c="dimmed">
                  • Mendapatkan kejelasan atas identitas, dasar hukum, dan tujuan pemrosesan data.
                </Text>
                <Text size="sm" c="dimmed">
                  • Memperbarui atau memperbaiki data profil pribadi Anda.
                </Text>
                <Text size="sm" c="dimmed">
                  • Mengajukan permohonan penghapusan atau pemusnahan data akun Anda dari sistem kami.
                </Text>
              </Stack>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                6. Keamanan &amp; Enkripsi
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                Kami menerapkan standar pengamanan teknis yang ketat: komunikasi HTTPS/TLS terenkripsi,
                hash token kriptografi satu arah, serta pembatasan satu sesi login aktif per akun
                guna mencegah pembajakan sesi di peramban yang tidak sah.
              </Text>
            </section>
          </Stack>
        </Paper>

        <Group justify="center" mt="md">
          <Button component={Link} href="/" color="blue" size="md">
            Saya Mengerti &amp; Kembali
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
