"use client";

import { Container, Group, Text, Anchor, Stack, SimpleGrid, Divider } from "@mantine/core";
import Link from "next/link";
import classes from "./landing.module.css";

export function LandingFooter() {
  return (
    <footer className={classes.footer}>
      <Container size="xl">
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="xl" mb="xl">
          {/* Column 1: Brand & Description */}
          <Stack gap="sm">
            <div className={classes.brandLogo}>
              <div className={classes.brandIconWrapper}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6Z" />
                </svg>
              </div>
              <Text span fw={800} size="md">
                satulabs<span className={classes.brandDot}>.id</span>
              </Text>
            </div>
            <Text size="xs" c="dimmed" lh={1.6}>
              Platform studio AI video dan photo untuk kebebasan kreasi tanpa batas. Sistem saldo sparks pay-as-you-go tanpa langganan kartu kredit otomatis.
            </Text>
          </Stack>

          {/* Column 2: Produk & Layanan */}
          <Stack gap="xs">
            <Text size="sm" fw={700} c="white">
              Produk & Layanan
            </Text>
            <Anchor component={Link} href="/app/generate" size="xs" c="dimmed" underline="hover">
              AI Image Studio
            </Anchor>
            <Anchor component={Link} href="/app/generate" size="xs" c="dimmed" underline="hover">
              AI Cinematic Video Generator
            </Anchor>
            <Anchor component={Link} href="/pricing" size="xs" c="dimmed" underline="hover">
              Katalog Harga & Paket Sparks
            </Anchor>
            <Anchor component={Link} href="/checkout" size="xs" c="dimmed" underline="hover">
              Halaman Pembelian (Checkout)
            </Anchor>
          </Stack>

          {/* Column 3: Legal & Ketentuan */}
          <Stack gap="xs">
            <Text size="sm" fw={700} c="white">
              Legal & Keamanan
            </Text>
            <Anchor component={Link} href="/terms" size="xs" c="dimmed" underline="hover">
              Ketentuan Layanan (Terms of Service)
            </Anchor>
            <Anchor component={Link} href="/privacy" size="xs" c="dimmed" underline="hover">
              Kebijakan Privasi (Privacy Policy)
            </Anchor>
            <Anchor component={Link} href="/terms#refund" size="xs" c="dimmed" underline="hover">
              Kebijakan Pengembalian Dana
            </Anchor>
          </Stack>

          {/* Column 4: Alamat & Kontak Dukungan */}
          <Stack gap="xs">
            <Text size="sm" fw={700} c="white">
              Kontak & Alamat Bisnis
            </Text>
            <Text size="xs" c="dimmed" lh={1.5}>
              <strong>Alamat Operasional:</strong>
              <br />
              SatuLabs Studio, Jakarta, Indonesia
            </Text>
            <Text size="xs" c="dimmed" lh={1.5}>
              <strong>Layanan Pelanggan / WhatsApp:</strong>
              <br />
              <Anchor href="https://wa.me/6281388638800" target="_blank" rel="noopener noreferrer" c="dimmed" underline="hover">
                +62 813-8863-8800
              </Anchor>
            </Text>
            <Text size="xs" c="dimmed" lh={1.5}>
              <strong>Email Dukungan:</strong>
              <br />
              <Anchor href="mailto:support@satulabs.id" c="dimmed" underline="hover">
                support@satulabs.id
              </Anchor>
            </Text>
          </Stack>
        </SimpleGrid>

        <Divider my="md" color="rgba(255, 255, 255, 0.08)" />

        <Group justify="space-between" align="center">
          <Text size="xs" c="dimmed">
            &copy; {new Date().getFullYear()} SatuLabs (satulabs.id). Seluruh hak cipta dilindungi undang-undang.
          </Text>
          <Group gap="md">
            <Anchor component={Link} href="/terms" size="xs" c="dimmed" underline="hover">
              Ketentuan
            </Anchor>
            <Anchor component={Link} href="/privacy" size="xs" c="dimmed" underline="hover">
              Privasi
            </Anchor>
            <Anchor href="https://discord.gg/AgRajbj2b" target="_blank" rel="noopener noreferrer" size="xs" c="dimmed" underline="hover">
              Discord Community
            </Anchor>
          </Group>
        </Group>
      </Container>
    </footer>
  );
}
