"use client";

import { Container, Grid, Stack, Title, Text, Button, Anchor } from "@mantine/core";
import Link from "next/link";
import classes from "./landing.module.css";

const PRIVACY_POINTS = [
  {
    title: "100% Privat & Bukan Tontonan Orang Lain",
    description:
      "Seluruh gambar dan video yang kamu buat tersimpan privat di Library akunmu. Ada cadangan cloud selama 14 hari agar kamu bisa mengunduhnya kapan saja ke perangkat. Bukan galeri publik yang bisa diintip pengguna lain.",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    title: "Bukan Bahan Latihan Model AI Publik",
    description:
      "Kami tidak menjual data pribadimu dan tidak menggunakan prompt atau hasil karyamu untuk melatih model AI publik tanpa izin eksplisit darimu.",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    title: "Satu Sesi Login Aman Anti-Bajak",
    description:
      "Diterapkan sistem proteksi satu sesi aktif per akun untuk mencegah penyalahgunaan akun di perangkat lain.",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
];

export function LandingPrivacy() {
  return (
    <section className={classes.privacySection} id="privasi">
      <Container size="xl">
        <Grid gutter={48} align="center">
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Stack gap="lg">
              <div>
                <span className={classes.sectionTag}>
                  BEBAS BERKREASI · PRIVASI TETAP NOMOR SATU
                </span>
              </div>

              <Title className={classes.sectionTitle} order={2}>
                Karyamu Bukan
                <br />
                <span className={classes.heroTitleHighlight}>Konsumsi Publik.</span>
              </Title>

              <Text size="md" c="#94a3b8" lh={1.6}>
                Lagi bereksperimen dengan ide visual rahasia atau materi promosi brand yang belum resmi rilis?
                Hasil karyamu di satulabs.id tidak otomatis masuk ke galeri publik. Kamu bisa bereksperimen dengan
                tenang, lalu unduh dan simpan sendiri hasilnya ke perangkat pribadimu.
              </Text>

              <div>
                <Button
                  component={Link}
                  href="/privacy"
                  variant="light"
                  color="violet"
                  size="md"
                  radius="md"
                  rightSection={
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
                      <path d="M5 12h14m-6-6 6 6-6 6" />
                    </svg>
                  }
                >
                  Lihat Detail Kebijakan Privasi
                </Button>
              </div>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 7 }}>
            <Stack gap="md">
              {PRIVACY_POINTS.map((item) => (
                <div key={item.title} className={classes.privacyItem}>
                  <div className={classes.privacyItemIcon}>{item.icon}</div>
                  <Stack gap={4}>
                    <Title order={4} size="h5" c="white">
                      {item.title}
                    </Title>
                    <Text size="sm" c="#94a3b8" lh={1.6}>
                      {item.description}
                    </Text>
                  </Stack>
                </div>
              ))}

              <Text size="xs" c="dimmed" mt="xs" lh={1.5}>
                ℹ️ <strong>Transparansi Data:</strong> Metadata antrian dan log transaksi sparks dicatat semata-mata
                untuk memproses antrian teknis GPU dan keamanan saldo. Detail lengkap tercantum pada{" "}
                <Anchor component={Link} href="/privacy" c="violet.4" size="xs">
                  Kebijakan Privasi
                </Anchor>
                .
              </Text>
            </Stack>
          </Grid.Col>
        </Grid>
      </Container>
    </section>
  );
}
