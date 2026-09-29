"use client";

import { Container, Title, Text } from "@mantine/core";
import classes from "./landing.module.css";

const PAIN_POINTS = [
  {
    title: "Biaya Fotografi & Sewa Studio yang Selangit",
    description:
      "Sesi foto produk komersial atau video model fisik menuntut anggaran jutaan rupiah, logistik ribet, dan waktu pengerjaan berhari-hari hanya untuk beberapa materi visual.",
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
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    title: "Langganan Bulanan Mengikat & Wajib Kartu Kredit",
    description:
      "Platform AI global menagih puluhan dolar setiap bulan secara otomatis via kartu kredit internasional, meskipun kamu hanya butuh beberapa gambar atau video sesekali.",
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
    title: "Sintaks Prompt Teknis yang Membuang Waktu",
    description:
      "Banyak alat AI menuntut istilah teknis berbelit-belit hanya untuk mendapatkan hasil yang pas. Waktu habis untuk coba-coba formula rumit, bukan untuk mengeksekusi ide bisnis.",
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
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
];

export function LandingPainPoints() {
  return (
    <section className={classes.painSection} id="keunggulan">
      <Container size="xl">
        <div className={classes.sectionHeader}>
          <span className={classes.sectionTag} style={{ color: "#f87171" }}>
            KENDALA UTAMA PRODUKSI KONTEN TRADISIONAL
          </span>
          <Title className={classes.sectionTitle} order={2}>
            Butuh Materi Visual Berkualitas,
            <br />
            <span style={{ color: "#f87171" }}>
              Tapi Biaya &amp; Langganan Selalu Memberatkan.
            </span>
          </Title>
          <Text className={classes.sectionSubtitle}>
            Idenya sudah siap. Kebutuhan materi promosi atau konten media sosial sudah mendesak.
            Namun biaya mahal dan persyaratan teknis seringkali menjadi penghalang utama.
          </Text>
        </div>

        <div className={classes.painGrid}>
          {PAIN_POINTS.map((item) => (
            <div className={classes.painCard} key={item.title}>
              <div className={classes.painIcon}>{item.icon}</div>
              <h3 className={classes.bentoTitle}>{item.title}</h3>
              <p className={classes.bentoDesc}>{item.description}</p>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 48,
            padding: "24px 32px",
            borderRadius: 16,
            background: "rgba(99, 102, 241, 0.1)",
            border: "1px solid rgba(139, 92, 246, 0.3)",
            textAlign: "center",
            maxWidth: 820,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <Text size="md" c="#c7d2fe" fw={600}>
            Di <strong>satulabs.id</strong>, kamu memegang kendali penuh atas anggaran.
            Tanpa biaya langganan bulanan mengikat, gunakan deskripsi bahasa alami sehari-hari, dan
            cukup beli sparks saat kamu butuh mulai dari <strong>Rp 49.000</strong>.
          </Text>
        </div>
      </Container>
    </section>
  );
}
