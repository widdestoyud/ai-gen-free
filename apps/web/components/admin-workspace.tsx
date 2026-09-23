"use client";

import { AppShell, Badge, Burger, Group, NavLink, Stack, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LogoutConfirmModal } from "./logout-confirm-modal";
import { useAdminLogoutConfirm } from "@/hooks/use-admin-logout-confirm";
import classes from "./app-workspace.module.css";

const ADMIN_NAV = [
  { href: "/admin", label: "Kurasi", matchExact: true },
  { href: "/admin/models", label: "Model AI", matchExact: false },
  { href: "/admin/packages", label: "Paket Poin", matchExact: false },
  { href: "/admin/settings", label: "Cooldown", matchExact: false },
  { href: "/admin/users", label: "User", matchExact: false },
  { href: "/admin/jobs", label: "Job", matchExact: false },
  { href: "http://localhost:5050", label: "Telemetry Log ↗", matchExact: false, external: true },
  { href: "/admin/audit", label: "Audit", matchExact: false },
];

export function AdminWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [opened, { toggle }] = useDisclosure();
  const logout = useAdminLogoutConfirm();

  const isNavActive = (href: string, matchExact?: boolean) => {
    if (matchExact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <AppShell
        header={{ height: 56 }}
        navbar={{ width: 220, breakpoint: "sm", collapsed: { mobile: !opened } }}
        padding="md"
      >
        <AppShell.Header className={classes.header}>
          <Group h="100%" px="md" justify="space-between">
            <Group gap="sm">
              <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
              <Group gap="xs">
                <Title order={4} className={classes.brand}>
                  ai-gen-free
                </Title>
                <Badge size="xs" variant="light" color="blue">
                  Admin
                </Badge>
              </Group>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar className={classes.navbar} p="sm">
          <Stack justify="space-between" h="100%">
            <Stack gap={4}>
              {ADMIN_NAV.map((item) => (
                <NavLink
                  key={item.href}
                  component={Link}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noreferrer" : undefined}
                  prefetch={false}
                  label={item.label}
                  active={!item.external && isNavActive(item.href, item.matchExact)}
                  className={classes.nav}
                />
              ))}
            </Stack>
            <NavLink
              label="Logout"
              className={classes.logout}
              onClick={(event) => {
                event.preventDefault();
                logout.openConfirm();
              }}
            />
          </Stack>
        </AppShell.Navbar>

        <AppShell.Main>{children}</AppShell.Main>
      </AppShell>

      <LogoutConfirmModal
        opened={logout.opened}
        onClose={logout.closeConfirm}
        onConfirm={logout.confirmLogout}
        pending={logout.pending}
        error={logout.error}
      />
    </>
  );
}
