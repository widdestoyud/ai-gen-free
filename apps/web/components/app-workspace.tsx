"use client";

import { AppShell, Burger, Group, NavLink, Stack, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LogoutConfirmModal } from "./logout-confirm-modal";
import { useLogoutConfirm } from "@/hooks/use-logout-confirm";
import classes from "./app-workspace.module.css";

const NAV = [
  { href: "/app/generate", label: "Generate" },
  { href: "/app/profile", label: "Profile" },
  { href: "/app/usage", label: "Usage" },
  { href: "/app/billing", label: "Billing" },
];

export function AppWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [opened, { toggle }] = useDisclosure();
  const logout = useLogoutConfirm();

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
              <Title order={4} className={classes.brand}>
                ai-gen-free
              </Title>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar className={classes.navbar} p="sm">
          <Stack justify="space-between" h="100%">
            <Stack gap={4}>
              {NAV.map((item) => (
                <NavLink
                  key={item.href}
                  component={Link}
                  href={item.href}
                  label={item.label}
                  active={pathname === item.href}
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
