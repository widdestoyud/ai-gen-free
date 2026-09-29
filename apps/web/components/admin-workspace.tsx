"use client";

import { AppShell, Badge, Burger, Group, NavLink, Stack, Title } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { LogoutConfirmModal } from "./logout-confirm-modal";
import { useAdminLogoutConfirm } from "@/hooks/use-admin-logout-confirm";
import classes from "./app-workspace.module.css";

function InboxIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function CpuIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="16" height="16" x="4" y="4" rx="2" />
      <rect width="6" height="6" x="9" y="9" />
      <path d="M15 2v2" />
      <path d="M15 20v2" />
      <path d="M2 15h2" />
      <path d="M2 9h2" />
      <path d="M20 15h2" />
      <path d="M20 9h2" />
      <path d="M9 2v2" />
      <path d="M9 20v2" />
    </svg>
  );
}

function PackageIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

function SlidersIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" x2="4" y1="21" y2="14" />
      <line x1="4" x2="4" y1="10" y2="3" />
      <line x1="12" x2="12" y1="21" y2="12" />
      <line x1="12" x2="12" y1="8" y2="3" />
      <line x1="20" x2="20" y1="21" y2="16" />
      <line x1="20" x2="20" y1="12" y2="3" />
      <line x1="1" x2="7" y1="14" y2="14" />
      <line x1="9" x2="15" y1="8" y2="8" />
      <line x1="17" x2="23" y1="16" y2="16" />
    </svg>
  );
}

function UsersIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ActivityIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function ExternalLinkIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function ShieldCheckIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function LogoutNavIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

const ADMIN_NAV = [
  { href: "/admin", label: "Kurasi", icon: InboxIcon, matchExact: true },
  { href: "/admin/models", label: "Model AI", icon: CpuIcon, matchExact: false },
  { href: "/admin/packages", label: "Paket Sparks", icon: PackageIcon, matchExact: false },
  { href: "/admin/settings", label: "Cooldown", icon: SlidersIcon, matchExact: false },
  { href: "/admin/users", label: "User", icon: UsersIcon, matchExact: false },
  { href: "/admin/jobs", label: "Job", icon: ActivityIcon, matchExact: false },
  { href: "http://localhost:5050", label: "Telemetry Log ↗", icon: ExternalLinkIcon, matchExact: false, external: true },
  { href: "/admin/audit", label: "Audit", icon: ShieldCheckIcon, matchExact: false },
];

export function AdminWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [opened, { toggle, close }] = useDisclosure();
  const logout = useAdminLogoutConfirm();

  // Close mobile navbar on route changes
  useEffect(() => {
    close();
  }, [pathname, close]);

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
              <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
              <Group gap="xs">
                <Title order={4} className={classes.brand}>
                  satulabs.id
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
              {ADMIN_NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.href}
                    component={Link}
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noreferrer" : undefined}
                    prefetch={false}
                    label={item.label}
                    leftSection={<Icon size={18} />}
                    active={!item.external && isNavActive(item.href, item.matchExact)}
                    className={classes.nav}
                    onClick={() => close()}
                  />
                );
              })}
            </Stack>
            <NavLink
              label="Logout"
              leftSection={<LogoutNavIcon size={18} />}
              className={classes.logout}
              onClick={(event) => {
                event.preventDefault();
                close();
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
