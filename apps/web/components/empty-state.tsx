"use client";

import { Text } from "@mantine/core";

export function EmptyState({ children }: { children: string }) {
  return <Text c="dimmed">{children}</Text>;
}
