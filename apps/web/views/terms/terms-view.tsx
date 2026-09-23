"use client";

import { Container, Stack, Title, Text, Paper, Button, Group, Divider, Badge } from "@mantine/core";
import Link from "next/link";

export function TermsPageView() {
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
          <Badge variant="outline" color="blue">
            Diperbarui: September 2026
          </Badge>
        </Group>

        <div>
          <Title order={1} fz={{ base: "1.8rem", sm: "2.4rem" }} fw={900} mb="xs">
            Syarat &amp; Ketentuan Layanan
          </Title>
          <Text c="dimmed" size="sm">
            Harap baca syarat dan ketentuan ini secara saksama sebelum mendaftar atau
            menggunakan platform <strong>ai-gen-free</strong>.
          </Text>
        </div>

        <Divider />

        <Paper p="xl" withBorder radius="md" bg="var(--mantine-color-dark-8, #14171f)">
          <Stack gap="lg">
            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                1. Batasan Usia Minimum (18+ Tahun)
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                Layanan ini secara ketat hanya diperuntukkan bagi individu yang telah berusia{" "}
                <strong>18 (delapan belas) tahun ke atas</strong> atau telah dewasa secara hukum
                menurut peraturan perundang-undangan Republik Indonesia. Dengan mendaftar akun
                atau menggunakan platform, Anda menyatakan dan menjamin bahwa Anda telah memenuhi
                syarat usia tersebut. Pendaftaran atau penggunaan oleh anak di bawah umur dilarang
                keras dan akan langsung dibatalkan atau diblokir.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                2. Pendaftaran Akun &amp; Keamanan Sesi
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                Pengguna wajib mendaftarkan alamat email resmi yang valid dan dapat dihubungi.
                Platform menerapkan kebijakan <strong>satu sesi aktif per pengguna</strong> untuk
                mencegah penyalahgunaan dan pembajakan akun. Setiap login baru pada perangkat lain
                akan mencabut sesi lama dan dapat memicu verifikasi kode OTP ke email terdaftar.
                Pengguna bertanggung jawab penuh atas segala aktivitas yang terjadi di bawah akun
                pribadi mereka.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                3. Sistem Saldo, Poin, &amp; Aturan Transaksi
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                Seluruh aktivitas pembuatan media (gambar atau video) menggunakan saldo poin yang
                diatur oleh sistem buku besar (*ledger*). Saat proses generasi dimulai, sejumlah poin
                akan ditahan sementara (*hold*). Poin hanya akan dipotong (*capture*) apabila proses
                generasi berhasil diselesaikan. Jika terjadi kegagalan sistem, poin yang ditahan akan
                secara otomatis dikembalikan (*release*) seutuhnya ke saldo akun Anda.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                4. Pembatasan Konten &amp; Larangan Hukum
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                Meskipun platform memberikan kebebasan eksplorasi kreatif tanpa sensor moralitas
                kaku, Anda dilarang keras memproduksi, memproses, mengunggah, atau menyebarkan:
              </Text>
              <Stack gap="xs" mt="xs" pl="md">
                <Text size="sm" c="dimmed">
                  • Materi yang melibatkan atau mengeksploitasi anak di bawah umur (CSAM/CSAE)
                  dalam bentuk apa pun.
                </Text>
                <Text size="sm" c="dimmed">
                  • Konten deepfake non-konsensual yang mencemarkan, merugikan, atau melanggar
                  hak privasi orang nyata tanpa persetujuan sah.
                </Text>
                <Text size="sm" c="dimmed">
                  • Konten kekerasan ekstrem, terorisme, ujaran kebencian SARA, atau pelanggaran
                  hukum pidana yang berlaku di Indonesia.
                </Text>
              </Stack>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                5. Hak Cipta &amp; Kepemilikan Hasil Karya
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                Karya yang dihasilkan dari prompt dan kreasi Anda menjadi hak dan tanggung jawab
                Anda sepenuhnya. Platform tidak mengklaim kepemilikan hak cipta atas karya yang
                dihasilkan dan tidak menjual data atau karya Anda kepada pihak ketiga.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                6. Retensi Data &amp; Penyimpanan Media (TTL 14 Hari)
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                File hasil generasi disimpan secara privat di penyimpanan awan (*object storage*)
                dengan batas retensi waktu simpan default selama <strong>14 (empat belas) hari</strong>.
                Pengguna sangat disarankan untuk mengunduh karya ke perangkat masing-masing sebelum
                masa retensi berakhir.
              </Text>
            </section>

            <section>
              <Title order={3} size="h4" mb="xs" c="white">
                7. Batasan Tanggung Jawab &amp; Penangguhan
              </Title>
              <Text size="sm" c="gray.3" lh={1.6}>
                Layanan disediakan sebagaimana adanya (*as-is*). Platform berhak melakukan tindakan
                penangguhan (*suspension*) atau pemblokiran akun secara sepihak apabila terbukti
                terjadi pelanggaran berat terhadap Syarat &amp; Ketentuan ini.
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
