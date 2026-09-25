"use client";

import { Container, Group, Text, Stack, Anchor } from "@mantine/core";
import Link from "next/link";
import classes from "./landing.module.css";

export function LandingFooter() {
  return (
    <footer className={classes.footer}>
      <Container size="lg">
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <div className={classes.brandLogo}>
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6Z" />
              </svg>
              <Text span fw={800} size="md">
                satulabs<span className={classes.brandDot}>.id</span>
              </Text>
            </div>
            <Text size="xs" c="dimmed">
              Platform Studio Generatif. Pilihanmu, kendalimu.
            </Text>
          </Stack>

          <Group gap="lg">
            <Anchor component={Link} href="/terms" size="xs" c="dimmed" underline="hover">
              Ketentuan Layanan
            </Anchor>
            <Anchor component={Link} href="/privacy" size="xs" c="dimmed" underline="hover">
              Kebijakan Privasi
            </Anchor>
            <Text size="xs" c="dimmed">
              satulabs.id {new Date().getFullYear()}
            </Text>
          </Group>
        </Group>
      </Container>
    </footer>
  );
}
