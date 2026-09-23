"use client";

import { Container, Grid, Title, Text, Stack } from "@mantine/core";
import classes from "./landing.module.css";

const STEPS = [
  {
    step: "01",
    title: "Buat Akun & Masuk Cepat",
    description:
      "Daftar dengan email kamu dalam hitungan detik. Verifikasi mudah lewat OTP email tanpa password rumit atau data berbelit-belit.",
  },
  {
    step: "02",
    title: "Ketik Ide & Atur Format",
    description:
      "Tuliskan prompt dalam Bahasa Indonesia atau Inggris. Tentukan rasio gambar (1:1, 16:9, 9:16) atau durasi video, lalu klik tombol generate.",
  },
  {
    step: "03",
    title: "Simpan & Unduh Karyamu",
    description:
      "Hasil langsung diproses secara asinkron. Unduh langsung ke HP atau laptop dengan resolusi tajam, atau lihat riwayatnya di Library akunmu.",
  },
];

export function LandingSteps() {
  return (
    <section className={classes.stepsSection} id="langkah">
      <Container size="lg">
        <Stack align="center" ta="center" mb={56}>
          <Text size="xs" fw={800} c="blue.4" tt="uppercase" lts={1}>
            TIDAK PERLU PENGATURAN RUMIT
          </Text>
          <Title order={2} fz={{ base: "1.8rem", sm: "2.6rem" }} fw={900}>
            Tiga langkah.
            <br />
            Langsung <span className={classes.heroTitleHighlight}>mulai berkarya.</span>
          </Title>
          <Text c="dimmed" maw={600} fz="md">
            Buka langsung dari peramban HP atau laptop. Tanpa instalasi software berat,
            antarmuka ramah Bahasa Indonesia.
          </Text>
        </Stack>

        <Grid gutter="xl">
          {STEPS.map((item) => (
            <Grid.Col span={{ base: 12, md: 4 }} key={item.step}>
              <div className={classes.stepCard}>
                <div className={classes.stepNumber}>{item.step}</div>
                <Title order={4} mt="sm" mb="xs" c="white">
                  {item.title}
                </Title>
                <Text size="sm" c="dimmed" lh={1.6}>
                  {item.description}
                </Text>
              </div>
            </Grid.Col>
          ))}
        </Grid>
      </Container>
    </section>
  );
}
