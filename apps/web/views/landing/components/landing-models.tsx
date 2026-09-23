"use client";

import { Container, Text, Group } from "@mantine/core";
import classes from "./landing.module.css";

const CAPABILITIES = [
  "Studio Gambar T2I & I2I",
  "Rasio Aspek 1:1 · 16:9 · 9:16 · 4:3 · 3:4",
  "Video Sinematik 6s · 10s · 15s",
  "Resolusi Video 480p · 720p · 1080p",
  "Spicy Mode Bebas Sensor",
  "Penyimpanan Privat 14 Hari",
  "Proteksi Saldo (Hold & Release)",
  "Unduh Langsung ke Perangkat",
  "Satu Sesi Aman Anti-Bajak",
  "Verifikasi Cepat OTP Email",
];

export function LandingModels() {
  return (
    <section className={classes.modelsSection} id="keunggulan">
      <Container size="lg" mb="md">
        <Group justify="space-between" align="center">
          <Text size="sm" c="dimmed">
            Semua kemampuan studio kreatif terpadu dalam satu antarmuka sederhana:
          </Text>
          <Text size="xs" c="blue.4" fw={600}>
            Tanpa Perlu Setup Rumit · Langsung Generate
          </Text>
        </Group>
      </Container>

      <div className={classes.marqueeTrack}>
        <div className={classes.marqueeGroup}>
          {CAPABILITIES.map((item) => (
            <span key={item} className={classes.modelBadge}>
              {item}
            </span>
          ))}
        </div>
        <div className={classes.marqueeGroup} aria-hidden="true">
          {CAPABILITIES.map((item) => (
            <span key={`${item}-clone`} className={classes.modelBadge}>
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
