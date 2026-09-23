"use client";

import { Container, Title, Text, Stack, Button } from "@mantine/core";
import classes from "./landing.module.css";

interface LandingCtaProps {
  onStartCreation: () => void;
}

export function LandingCta({ onStartCreation }: LandingCtaProps) {
  return (
    <section className={classes.ctaSection}>
      <Container size="md">
        <Stack align="center" gap="lg">
          <Text size="xs" fw={800} c="blue.4" tt="uppercase" lts={1}>
            SIAP TINGKATKAN KUALITAS KONTENMU?
          </Text>
          <Title order={2} fz={{ base: "2rem", sm: "3rem" }} fw={900}>
            Tinggalkan biaya mahal.
            <br />
            <span className={classes.heroTitleHighlight}>Ciptakan visual studio seketika.</span>
          </Title>
          <Text c="dimmed" maw={580} fz="md">
            Wujudkan ide materi promosi jualan dan konten media sosialmu langsung dalam
            bahasa alami sehari-hari. Tanpa ribet kartu kredit internasional, tanpa perlu keahlian teknis.
          </Text>
          <Button
            size="xl"
            color="blue"
            onClick={onStartCreation}
          >
            Mulai Buat Konten Sekarang
          </Button>
          <Text size="xs" c="dimmed">
            Paket starter mulai Rp 49.000 · 100% Galeri Privat · Poin berlaku selamanya
          </Text>
        </Stack>
      </Container>
    </section>
  );
}
