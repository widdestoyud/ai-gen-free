"use client";

import { Paper, Stack } from "@mantine/core";
import type { ReactNode } from "react";

export function ItemCard({ children }: { children: ReactNode }) {
  return (
    <Paper withBorder p="md" radius="md" mb="sm">
      <Stack gap="xs">{children}</Stack>
    </Paper>
  );
}
