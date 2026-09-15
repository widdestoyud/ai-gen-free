"use client";

import { Center, Text, type MantineSpacing } from "@mantine/core";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  children: ReactNode;
  minHeight?: number | string;
  py?: MantineSpacing;
  className?: string;
}

export function EmptyState({
  children,
  minHeight = 160,
  py = "xl",
  className,
}: EmptyStateProps) {
  return (
    <Center mih={minHeight} py={py} px="md" w="100%" className={className}>
      {typeof children === "string" || typeof children === "number" || Array.isArray(children) ? (
        <Text c="dimmed" ta="center">
          {children}
        </Text>
      ) : (
        children
      )}
    </Center>
  );
}

