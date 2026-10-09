"use client";

import { Container, Group, Text, Anchor } from "@mantine/core";
import Link from "next/link";
import classes from "./landing.module.css";

export function LandingFooter() {
  return (
    <footer className={classes.footer}>
      <Container size="xl">
        <Group justify="space-between" align="center">
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

          <Group gap="xl">
            <Anchor component={Link} href="/#pricing" size="xs" c="dimmed" underline="hover">
              Harga & Paket
            </Anchor>
            <Anchor component={Link} href="/terms" size="xs" c="dimmed" underline="hover">
              Ketentuan Layanan
            </Anchor>
            <Anchor component={Link} href="/privacy" size="xs" c="dimmed" underline="hover">
              Kebijakan Privasi
            </Anchor>
            <Anchor href="https://discord.gg/AgRajbj2b" target="_blank" rel="noopener noreferrer" size="xs" c="dimmed" underline="hover">
              Support
            </Anchor>
            <Text size="xs" c="dimmed">
              &copy; {new Date().getFullYear()} satulabs.id
            </Text>
          </Group>
        </Group>
      </Container>
    </footer>
  );
}
