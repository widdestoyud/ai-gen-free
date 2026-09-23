"use client";

import { Container, Grid, Stack, Title, Text, Button, Anchor } from "@mantine/core";
import Link from "next/link";
import classes from "./landing.module.css";

const PRIVACY_POINTS = [
  {
    title: "Tidak Otomatis Jadi Tontonan Orang",
    description:
      "Seluruh gambar dan video yang kamu buat tersimpan privat di Library akunmu. Ada cadangan cloud selama 14 hari agar kamu bisa mengunduhnya kapan saja ke perangkat. Bukan feed publik yang bisa dilihat oleh pengguna lain.",
    icon: (
      <svg
        width="20"
        height="20"
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
    title: "Bukan Bahan Latihan AI Pihak Ketiga",
    description:
      "Kami tidak menjual data pribadimu dan tidak menggunakan prompt atau hasil karyamu untuk melatih model AI publik tanpa izin eksplisit darimu.",
    icon: (
      <svg
        width="20"
        height="20"
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
    title: "Sesi Tunggal & Enkripsi Data Aman",
    description:
      "Diterapkan sistem satu sesi login aktif per akun untuk mencegah pembajakan sesi di perangkat lain, didukung transmisi data terenkripsi dan penyimpanan hash token yang aman.",
    icon: (
      <svg
        width="20"
        height="20"
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
      <Container size="lg">
        <Grid gutter={48} align="center">
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Stack gap="md">
              <div>
                <Text size="xs" fw={800} c="blue.4" tt="uppercase" lts={1}>
                  BEBAS BERKREASI · PRIVASI TETAP UTAMA
                </Text>
              </div>

              <Title order={2} fz={{ base: "1.8rem", sm: "2.6rem" }} fw={900}>
                Karyamu bukan
                <br />
                <span className={classes.heroTitleHighlight}>konsumsi publik.</span>
              </Title>

              <Text size="md" c="gray.3" lh={1.6}>
                Lagi mencoba ide visual atau materi promosi yang belum siap dilihat orang? Hasil
                karyamu tidak otomatis masuk ke galeri publik. Kamu bisa bereksperimen dengan
                bebas, lalu unduh dan simpan sendiri hasilnya ke perangkatmu.
              </Text>

              <div>
                <Button
                  component={Link}
                  href="/privacy"
                  variant="light"
                  color="blue"
                  size="sm"
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
                    <Text size="sm" c="dimmed" lh={1.6}>
                      {item.description}
                    </Text>
                  </Stack>
                </div>
              ))}

              <Text size="xs" c="dimmed" mt="xs" lh={1.5}>
                ℹ️ <strong>Transparansi Data:</strong> Sistem mencatat metadata antrian dan log
                transaksi poin semata-mata untuk memproses antrian teknis dan keamanan saldo. Detail
                lengkap tersedia di{" "}
                <Anchor component={Link} href="/privacy" c="blue.4" size="xs">
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
