"use client";

import { Anchor } from "@mantine/core";
import Link from "next/link";
import type { ReactNode } from "react";

export function AppLink({
  href,
  children,
  external,
}: {
  href: string;
  children: ReactNode;
  external?: boolean;
}) {
  if (external) {
    return (
      <Anchor href={href} target="_blank" rel="noreferrer">
        {children}
      </Anchor>
    );
  }
  return (
    <Anchor component={Link} href={href}>
      {children}
    </Anchor>
  );
}
