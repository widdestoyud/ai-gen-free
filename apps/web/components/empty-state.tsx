"use client";

import { Text } from "@mantine/core";
import type { ReactNode } from "react";

export function EmptyState({ children }: { children: ReactNode }) {
  return <Text c="dimmed">{children}</Text>;
}
