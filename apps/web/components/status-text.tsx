"use client";

import { Text } from "@mantine/core";
import type { ReactNode } from "react";

export function StatusText({
  ok,
  children,
}: {
  ok: boolean;
  children: ReactNode;
}) {
  return (
    <Text c={ok ? "teal" : "red"} mt="xs" mb={0}>
      {children}
    </Text>
  );
}
