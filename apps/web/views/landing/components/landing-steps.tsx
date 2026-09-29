"use client";

import { Container, Title, Text } from "@mantine/core";
import classes from "./landing.module.css";

const STEPS = [
  {
    step: "01",
    title: "Buat Akun & Masuk Cepat",
    description:
      "Daftar dengan email kamu dalam hitungan detik. Verifikasi mudah lewat kode OTP email tanpa ribet password rumit atau pengisian data berbelit-belit.",
  },
  {
    step: "02",
    title: "Ketik Ide & Atur Format",
    description:
      "Tuliskan prompt ide visual dalam Bahasa Indonesia atau Inggris. Tentukan format gambar (1:1, 16:9, 9:16) atau durasi video, lalu klik Generate.",
  },
  {
    step: "03",
    title: "Simpan & Unduh Karyamu",
    description:
      "Hasil langsung diproses secara cepat. Unduh langsung ke HP atau laptop dengan resolusi tajam, atau lihat arsip riwayatnya di Library akun privatmu.",
  },
];

export function LandingSteps() {
  return (
    <section className={classes.stepsSection} id="langkah">
      <Container size="xl">
        <div className={classes.sectionHeader}>
          <span className={classes.sectionTag}>TIDAK PERLU PENGATURAN RUMIT</span>
          <Title className={classes.sectionTitle} order={2}>
            Tiga Langkah Mudah.
            <br />
            <span className={classes.heroTitleHighlight}>
              Langsung Mulai Berkarya.
            </span>
          </Title>
          <Text className={classes.sectionSubtitle}>
            Buka langsung dari peramban HP atau laptop. Tanpa instalasi software berat,
            antarmuka bersih dan ramah pengguna.
          </Text>
        </div>

        <div className={classes.stepsGrid}>
          {STEPS.map((item) => (
            <div className={classes.stepCard} key={item.step}>
              <div className={classes.stepNumber}>{item.step}</div>
              <h3 className={classes.stepTitle}>{item.title}</h3>
              <p className={classes.stepDesc}>{item.description}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
