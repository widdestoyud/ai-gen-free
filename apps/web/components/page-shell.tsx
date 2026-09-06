"use client";

import { Container, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { AppLink } from "./app-link";

export function PageShell({
  kicker,
  title,
  backHref,
  backLabel = "← Kembali",
  size = "sm",
  children,
}: {
  kicker?: string;
  title: string;
  backHref?: string;
  backLabel?: string;
  size?: "xs" | "sm" | "md" | "lg";
  children: ReactNode;
}) {
  const maw = size === "xs" ? 420 : size === "md" ? 720 : size === "lg" ? 960 : 640;
  return (
    <Container size={maw} py="xl" px="lg">
      <Stack gap="md">
        {backHref ? <AppLink href={backHref}>{backLabel}</AppLink> : null}
        {kicker ? (
          <Text size="xs" tt="uppercase" c="dimmed" lts="0.08em">
            {kicker}
          </Text>
        ) : null}
        <Title order={1}>{title}</Title>
        {children}
      </Stack>
    </Container>
  );
}
