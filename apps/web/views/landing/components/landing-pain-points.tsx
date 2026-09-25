"use client";

import { Container, Grid, Title, Text, Stack } from "@mantine/core";
import classes from "./landing.module.css";

export function LandingPainPoints() {
  return (
    <section className={classes.painSection} id="keunggulan">
      <Container size="lg">
        <Stack align="center" ta="center" mb={48}>
          <Text size="xs" fw={800} c="red.4" tt="uppercase" lts={1}>
            KENDALA UTAMA PRODUKSI VISUAL
          </Text>
          <Title order={2} fz={{ base: "1.8rem", sm: "2.6rem" }} fw={900}>
            Butuh materi visual berkualitas tinggi,
            <br />
            tapi biaya dan sistem langganan{" "}
            <Text span c="red.4">
              selalu memberatkan.
            </Text>
          </Title>
          <Text c="dimmed" maw={620} fz="md">
            Idenya sudah siap. Kebutuhan materi promosi atau konten media sosial sudah mendesak.
            Namun biaya dan persyaratan teknis seringkali menjadi penghalang utama.
          </Text>
        </Stack>

        <Grid gutter="xl">
          <Grid.Col span={{ base: 12, md: 4 }}>
            <div className={classes.painCard}>
              <div className={classes.painIcon}>
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
              </div>
              <Title order={4} mb="xs" c="white">
                Biaya Fotografi &amp; Sewa Studio yang Tinggi
              </Title>
              <Text size="sm" c="dimmed" lh={1.6}>
                Mengadakan sesi pemotretan produk atau model fisik membutuhkan anggaran jutaan
                rupiah, koordinasi rumit, dan waktu pengerjaan berhari-hari untuk satu materi visual.
              </Text>
            </div>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <div className={classes.painCard}>
              <div className={classes.painIcon}>
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
              </div>
              <Title order={4} mb="xs" c="white">
                Langganan Bulanan Mengikat &amp; Wajib Kartu Kredit
              </Title>
              <Text size="sm" c="dimmed" lh={1.6}>
                Platform global memotong tagihan puluhan dolar setiap bulan secara otomatis,
                meskipun kamu hanya membutuhkan beberapa materi visual sesekali.
              </Text>
            </div>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <div className={classes.painCard}>
              <div className={classes.painIcon}>
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
              </div>
              <Title order={4} mb="xs" c="white">
                Sintaks Prompt Rumit yang Membuang Waktu
              </Title>
              <Text size="sm" c="dimmed" lh={1.6}>
                Banyak alat AI menuntut istilah teknis berbelit-belit hanya untuk mendapatkan
                hasil yang presisi. Waktu habis untuk coba-coba prompt, bukan untuk eksekusi ide.
              </Text>
            </div>
          </Grid.Col>
        </Grid>

        <Stack align="center" ta="center" mt={48}>
          <Text size="md" c="blue.3" fw={600} maw={760}>
            Di <strong>satulabs.id</strong>, kamu memegang kendali penuh atas anggaran.
            Tanpa biaya langganan mengikat, gunakan deskripsi bahasa alami sehari-hari, dan
            cukup beli poin saat kamu butuh mulai dari <strong>Rp 49.000</strong>.
          </Text>
        </Stack>
      </Container>
    </section>
  );
}
