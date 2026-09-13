"use client";

import { Button, Group, Text } from "@mantine/core";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { logoutAdmin } from "@/lib/auth-actions";
import { AppLink } from "@/components/app-link";
import { PageShell } from "@/components/page-shell";

const LINKS = [
  { href: "/admin", label: "Kurasi" },
  { href: "/admin/settings", label: "Cooldown" },
  { href: "/admin/users", label: "User" },
  { href: "/admin/jobs", label: "Job" },
  { href: "/admin/audit", label: "Audit" },
];

export function AdminUnauth() {
  return (
    <PageShell title="Admin">
      <Text>Sesi admin belum ada.</Text>
      <AppLink href="/admin">Masuk sebagai admin</AppLink>
    </PageShell>
  );
}

export function AdminPageShell({
  title,
  home,
  children,
}: {
  title: string;
  home?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <PageShell title={title} size="lg" backHref={home ? undefined : "/admin"} backLabel="← Admin">
      <Group gap="sm" justify="space-between">
        <Group gap="sm">
          {LINKS.map((link) => (
            <AppLink key={link.href} href={link.href}>
              {link.label}
            </AppLink>
          ))}
        </Group>
        <Button
          type="button"
          variant="default"
          size="xs"
          onClick={async () => {
            await logoutAdmin();
            router.push("/admin");
            router.refresh();
          }}
        >
          Keluar
        </Button>
      </Group>
      {children}
    </PageShell>
  );
}