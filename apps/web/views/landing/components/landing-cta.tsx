"use client";

import { Container, Title, Text, Stack, Button, Group } from "@mantine/core";
import classes from "./landing.module.css";

interface LandingCtaProps {
  onStartCreation: () => void;
}

export function LandingCta({ onStartCreation }: LandingCtaProps) {
  return (
    <section className={classes.ctaSection}>
      <Container size="lg">
        <div className={classes.ctaBox}>
          <Stack align="center" gap="lg">
            <span className={classes.sectionTag}>
              SIAP TINGKATKAN KUALITAS KONTENMU?
            </span>

            <Title className={classes.sectionTitle} order={2}>
              Tinggalkan Biaya Mahal.
              <br />
              <span className={classes.heroTitleHighlight}>
                Ciptakan Visual Studio Seketika.
              </span>
            </Title>

            <Text size="md" c="#94a3b8" maw={580} lh={1.6}>
              Wujudkan ide visual produk, video promosi sinematik, dan kampanye iklanmu langsung dalam bahasa alami sehari-hari.
              Tanpa kartu kredit internasional, tanpa perlu keahlian teknis.
            </Text>

            <Group gap="md" mt="xs">
              <Button
                size="lg"
                className={classes.headerBtnGlow}
                radius="md"
                onClick={onStartCreation}
                leftSection={
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6Z" />
                  </svg>
                }
              >
                Mulai Buat Konten Sekarang
              </Button>
            </Group>

            <Text size="xs" c="dimmed" mt="xs">
              Paket starter mulai Rp 49.000 · 100% Galeri Privat · Sparks aktif selamanya
            </Text>
          </Stack>
        </div>
      </Container>
    </section>
  );
}
