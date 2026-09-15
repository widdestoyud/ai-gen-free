"use client";

import { Group, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { AppLink } from "@/components/app-link";
import { PageShell } from "@/components/page-shell";

export function AdminUnauth() {
  return (
    <PageShell title="Admin">
      <AppLink href="/admin">Masuk sebagai admin</AppLink>
    </PageShell>
  );
}

export function AdminPageShell({
  title,
  home,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  home?: boolean;
  backHref?: string;
  backLabel?: string;
  children: ReactNode;
}) {
  const returnHref = backHref ?? (home ? undefined : "/admin");
  const returnLabel = backLabel ?? "← Kembali ke kurasi";

  return (
    <div>
      <Group justify="space-between" align="center" mb="md">
        <Title order={2}>{title}</Title>
        {returnHref ? <AppLink href={returnHref}>{returnLabel}</AppLink> : null}
      </Group>
      {children}
    </div>
  );
}