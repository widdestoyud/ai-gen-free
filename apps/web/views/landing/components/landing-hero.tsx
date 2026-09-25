"use client";

import { Container, Grid, Stack, Title, Text, Button, Group } from "@mantine/core";
import classes from "./landing.module.css";
import { LandingPreview } from "./landing-preview";
import type { PreviewTab } from "@/hooks/use-landing-page";

interface LandingHeroProps {
  onStartCreation: () => void;
  onScrollTo: (id: string) => void;
  activePreview: PreviewTab;
  onSelectPreview: (tab: PreviewTab) => void;
}

export function LandingHero({
  onStartCreation,
  onScrollTo,
  activePreview,
  onSelectPreview,
}: LandingHeroProps) {
  return (
    <section className={classes.heroSection}>
      <Container size="lg">
        <Grid gutter={48} align="center">
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Stack gap="lg">
              <Title className={classes.heroTitle} order={1}>
                <span className={classes.heroTitleHighlight}>Wujudkan ide kreatif kamu</span>
              </Title>

              <Text className={classes.heroLead}>
                Tinggalkan biaya sewa studio foto yang mahal dan langganan bulanan yang mengikat.
                Cukup ketik deskripsi visual yang kamu inginkan dan atur format sesuai keinginan kamu.
              </Text>

              <Group gap="md">
                <Button
                  size="lg"
                  color="blue"
                  onClick={onStartCreation}
                >
                  Mulai Buat Konten Sekarang
                </Button>
                <Button
                  size="lg"
                  variant="default"
                  onClick={() => onScrollTo("harga")}
                >
                  Lihat Paket
                </Button>
              </Group>

              <div className={classes.trustList}>
                <div className={classes.trustItem}>
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
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                  <span>Tanpa Biaya Langganan Bulanan · Pay-as-you-Go</span>
                </div>
                <div className={classes.trustItem}>
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
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span>Akses Pembayaran Instan</span>
                </div>
                <div className={classes.trustItem}>
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
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>Galeri 100% Privat</span>
                </div>
              </div>
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <LandingPreview
              activePreview={activePreview}
              onSelectPreview={onSelectPreview}
              onStartCreation={onStartCreation}
            />
          </Grid.Col>
        </Grid>
      </Container>
    </section>
  );
}
