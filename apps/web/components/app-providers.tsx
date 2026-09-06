"use client";

import { MantineProvider } from "@mantine/core";
import type { ReactNode } from "react";
import { theme } from "@/lib/theme";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      {children}
    </MantineProvider>
  );
}
