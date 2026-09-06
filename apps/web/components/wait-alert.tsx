"use client";

import { Alert } from "@mantine/core";
import type { ReactNode } from "react";

export function WaitAlert({ message, children }: { message?: string | null; children?: ReactNode }) {
  if (!message && !children) return null;
  return (
    <Alert color="yellow" variant="light">
      {message}
      {children}
    </Alert>
  );
}
