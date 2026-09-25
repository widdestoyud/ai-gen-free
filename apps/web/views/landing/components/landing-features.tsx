"use client";

import { Container, Grid, Title, Text, Stack } from "@mantine/core";
import classes from "./landing.module.css";

const FEATURES = [
  {
    title: "Foto Produk & Visual Komersial",
    category: "KATALOG & IKLAN",
    description:
      "Hasilkan materi promosi produk, visual kemasan, dan mockup katalog beresolusi tinggi seketika tanpa sewa fotografer atau studio fisik.",
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
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
  },
  {
    title: "Video Sinematik Dinamis",
    category: "KONTEN REELS & TIKTOK",
    description:
      "Ciptakan klip video dinamis 60fps untuk kebutuhan promosi media sosial dan iklan digital dengan pencahayaan sinematik dan gerakan kamera halus.",
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
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ),
  },
  {
    title: "Cukup Deskripsi Bahasa Alami",
    category: "TANPA RUMUS TEKNIS",
    description:
      "Tidak perlu kursus *prompt engineering* yang rumit. Cukup jelaskan apa yang ingin kamu buat secara wajar, dan sistem akan merendernya secara akurat.",
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
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    title: "Bayar Sesuai Kebutuhan (Pay-as-you-Go)",
    category: "FLEKSIBEL TANPA IKATAN",
    description:
      "Tidak ada tagihan bulanan otomatis yang mengikat. Cukup beli saldo poin saat kamu butuh, dan saldo poinmu tidak memiliki batas kedaluwarsa.",
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
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    title: "Akses Pembayaran Instan",
    category: "TANPA KARTU KREDIT",
    description:
      "Beli paket starter mulai dari Rp 49.000 dengan mudah melalui metode pembayaran instan tanpa memerlukan kartu kredit internasional.",
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
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    title: "Privasi Penuh & Penyimpanan 14 Hari",
    category: "DATA & HASIL AMAN",
    description:
      "Seluruh hasil tersimpan privat di Library akunmu selama 14 hari dan tidak pernah dipamerkan ke galeri publik.",
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

export function LandingFeatures() {
  return (
    <section className={classes.featuresSection} id="fitur">
      <Container size="lg">
        <Stack align="center" ta="center" mb={56}>
          <Text size="xs" fw={800} c="blue.4" tt="uppercase" lts={1}>
            DIBUAT KHUSUS UNTUK KREATIVITASMU
          </Text>
          <Title order={2} fz={{ base: "1.8rem", sm: "2.6rem" }} fw={900}>
            Solusi visual lengkap.
            <br />
            <span className={classes.heroTitleHighlight}>Cepat, hemat, dan praktis.</span>
          </Title>
          <Text c="dimmed" maw={640} fz="md">
            Mulai dari foto produk komersial, materi promosi, hingga konten media sosial.
            Semua bisa diwujudkan langsung dari peramban HP atau laptop kamu.
          </Text>
        </Stack>

        <Grid gutter="xl">
          {FEATURES.map((feature) => (
            <Grid.Col span={{ base: 12, sm: 6, md: 4 }} key={feature.title}>
              <div className={classes.featureCard}>
                <div className={classes.featureIcon}>{feature.icon}</div>
                <Text size="xs" fw={700} c="blue.4" mb={4}>
                  {feature.category}
                </Text>
                <Title order={4} mb="xs" c="white">
                  {feature.title}
                </Title>
                <Text size="sm" c="dimmed" lh={1.6}>
                  {feature.description}
                </Text>
              </div>
            </Grid.Col>
          ))}
        </Grid>
      </Container>
    </section>
  );
}
