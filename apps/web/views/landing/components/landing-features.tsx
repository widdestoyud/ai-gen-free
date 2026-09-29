"use client";

import { Container, Title, Text } from "@mantine/core";
import classes from "./landing.module.css";

const FEATURES = [
  {
    title: "Foto Produk & Katalog Komersial",
    category: "KATALOG & E-COMMERCE",
    description:
      "Hasilkan materi promosi produk, visual kemasan, dan mockup katalog beresolusi ultra-HD 4K seketika tanpa sewa fotografer atau studio fisik yang mahal.",
    icon: (
      <svg
        width="24"
        height="24"
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
    title: "Video Sinematik 60fps Multi-Rasio",
    category: "REELS, SHORTS & TIKTOK",
    description:
      "Ciptakan klip video dinamis 60fps dengan pencahayaan sinematik dan gerakan kamera halus dalam rasio 16:9, 9:16, atau 1:1 sesuai kebutuhan kontenmu.",
    icon: (
      <svg
        width="24"
        height="24"
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
    title: "Cukup Deskripsi Bahasa Sehari-hari",
    category: "TANPA RUMUS TEKNIS",
    description:
      "Tidak perlu kursus prompt engineering yang rumit. Cukup jelaskan apa yang ingin kamu buat secara wajar dalam Bahasa Indonesia atau Inggris.",
    icon: (
      <svg
        width="24"
        height="24"
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
    title: "Bayar Saat Butuh (Pay-as-you-Go)",
    category: "FLEKSIBEL TANPA IKATAN",
    description:
      "Tidak ada tagihan bulanan otomatis yang mengikat. Cukup beli saldo sparks saat kamu butuh mulai dari Rp 49.000, dan saldo sparks-mu tidak pernah kedaluwarsa.",
    icon: (
      <svg
        width="24"
        height="24"
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
    title: "Akses Pembayaran Instan Tanpa Kartu Kredit",
    category: "METODE PEMBAYARAN LOKAL",
    description:
      "Beli paket dengan cepat menggunakan QRIS, e-wallet, dan Virtual Account bank lokal tanpa perlu kartu kredit internasional.",
    icon: (
      <svg
        width="24"
        height="24"
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
    title: "Proteksi Saldo & Garansi 100% Aman",
    category: "HOLD-CAPTURE-RELEASE",
    description:
      "Sparks hanya dipotong jika proses render selesai dengan sukses. Jika terjadi kendala antrian atau sistem, sparks otomatis dikembalikan seutuhnya ke saldo akunmu.",
    icon: (
      <svg
        width="24"
        height="24"
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
    <section className={classes.spotlightSectionDarker} id="fitur">
      <Container size="xl">
        <div className={classes.sectionHeader}>
          <span className={classes.sectionTag}>FITUR &amp; ALUR KERJA CERDAS</span>
          <Title className={classes.sectionTitle} order={2}>
            Solusi Visual Lengkap.
            <br />
            <span className={classes.heroTitleHighlight}>
              Cepat, Hemat, dan Siap Pakai.
            </span>
          </Title>
          <Text className={classes.sectionSubtitle}>
            Semua kebutuhan produksi visual kreatif dipadatkan ke dalam browser HP dan laptop kamu.
            Hemat biaya hingga 90% dibanding produksi konvensional.
          </Text>
        </div>

        <div className={classes.bentoGrid}>
          {FEATURES.map((feature) => (
            <div className={classes.bentoCard} key={feature.title}>
              <div className={classes.bentoIconWrapper}>{feature.icon}</div>
              <span className={classes.bentoTag}>{feature.category}</span>
              <h3 className={classes.bentoTitle}>{feature.title}</h3>
              <p className={classes.bentoDesc}>{feature.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
