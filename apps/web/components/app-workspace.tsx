"use client";

import {
  AppShell,
  Burger,
  Divider,
  Group,
  Menu,
  NavLink,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { LogoutConfirmModal } from "./logout-confirm-modal";
import { useLogoutConfirm } from "@/hooks/use-logout-confirm";
import { useWallet } from "@/hooks/use-wallet";
import { requestJson } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import classes from "./app-workspace.module.css";

function SparklesIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3 1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}

function LibraryIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function ProfileIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function BillingIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </svg>
  );
}

function OrderIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <line x1="3" x2="21" y1="6" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function GlobeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function MoreHorizontalIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
      <circle cx="5" cy="12" r="1.5" />
    </svg>
  );
}

function LogoutIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

export function AppWorkspace({ children }: { children: ReactNode }) {
  const { t, locale, setLocale } = useI18n("nav");
  const pathname = usePathname();
  const [opened, { toggle, close }] = useDisclosure();
  const [langExpanded, setLangExpanded] = useState(false);
  const logout = useLogoutConfirm();
  const queryClient = useQueryClient();
  const wallet = useWallet();

  const { data: profileData } = useQuery<{
    user?: { email?: string; displayName?: string; avatarUrl?: string };
  }>({
    queryKey: queryKeys.customerProfile(),
    queryFn: async () => {
      const res = await requestJson<{
        user?: { email?: string; displayName?: string; avatarUrl?: string };
      }>("/api/customer-profile");
      return res.ok && res.data ? res.data : {};
    },
    staleTime: 30000,
  });

  const user = profileData?.user;
  const userName = user?.displayName?.trim() || user?.email || "Pengguna";
  const userInitial = (user?.displayName?.trim()?.[0] || user?.email?.[0] || "P").toUpperCase();

  const navItems = [
    { href: "/app/generate", label: t("generate"), icon: SparklesIcon },
    { href: "/app/library", label: t("library"), icon: LibraryIcon },
    { href: "/app/billing", label: t("billing"), icon: BillingIcon },
  ];

  // Close mobile navbar on route changes
  useEffect(() => {
    close();
  }, [pathname, close]);

  // Global Realtime SSE listener for user invoice & balance events
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      try {
        eventSource = new EventSource("/api/invoices/events");

        eventSource.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed?.type === "invoice_updated") {
              void queryClient.invalidateQueries({ queryKey: queryKeys.wallet() });
              void queryClient.invalidateQueries({ queryKey: queryKeys.billingLedger() });
              void queryClient.invalidateQueries({ queryKey: queryKeys.orderInvoices() });
              void queryClient.invalidateQueries({ queryKey: queryKeys.customerProfile() });
            }
          } catch {}
        };

        eventSource.onerror = () => {
          eventSource?.close();
          eventSource = null;
          reconnectTimer = setTimeout(connect, 5000);
        };
      } catch {}
    }

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      eventSource?.close();
    };
  }, [queryClient]);

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
              <Group gap={8} align="center">
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                  }}
                >
                  <SparklesIcon size={16} />
                </div>
                <Title order={4} className={classes.brand}>
                  satulabs.id
                </Title>
              </Group>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar className={classes.navbar} p="sm">
          <Stack justify="space-between" h="100%">
            <Stack gap={4}>
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.href}
                    component={Link}
                    href={item.href}
                    label={item.label}
                    leftSection={<Icon size={18} />}
                    active={pathname === item.href}
                    className={classes.nav}
                    onClick={() => close()}
                  />
                );
              })}
            </Stack>

            {/* Bottom Section: User Info Card & Ellipsis Menu */}
            <div className={classes.bottomSection}>
              <Divider my="xs" color="rgba(255, 255, 255, 0.08)" />

              <Menu
                position="top-start"
                offset={10}
                width={220}
                shadow="xl"
                withinPortal
                transitionProps={{ transition: "pop", duration: 150 }}
                onClose={() => setLangExpanded(false)}
              >
                <Menu.Target>
                  <UnstyledButton
                    className={classes.userCard}
                    aria-label="Menu akun pengguna"
                  >
                    <div className={classes.userAvatar}>
                      {userInitial}
                    </div>
                    <div className={classes.userInfo}>
                      <span className={classes.userName} title={userName}>
                        {userName}
                      </span>
                      <span className={classes.userSparks}>
                        {wallet.available.toLocaleString()} Sparks
                      </span>
                    </div>
                    <div className={classes.moreIcon}>
                      <MoreHorizontalIcon size={18} />
                    </div>
                  </UnstyledButton>
                </Menu.Target>

                <Menu.Dropdown className={classes.menuDropdown}>
                  {/* 1. Profil */}
                  <Menu.Item
                    component={Link}
                    href="/app/profile"
                    leftSection={<ProfileIcon size={16} />}
                    className={classes.menuItem}
                    onClick={() => close()}
                  >
                    {t("profile")}
                  </Menu.Item>

                  {/* 2. Pesanan */}
                  <Menu.Item
                    component={Link}
                    href="/app/order"
                    leftSection={<OrderIcon size={16} />}
                    className={classes.menuItem}
                    onClick={() => close()}
                  >
                    {t("order")}
                  </Menu.Item>

                  {/* 3. Bahasa */}
                  <Menu.Item
                    leftSection={<GlobeIcon size={16} />}
                    rightSection={
                      <Group gap={4} wrap="nowrap" align="center">
                        <Text size="xs" c="dimmed" fw={600}>
                          {locale === "id" ? "ID" : "EN"}
                        </Text>
                        <span
                          style={{
                            fontSize: "10px",
                            color: "#94a3b8",
                            transform: langExpanded ? "rotate(180deg)" : "rotate(0deg)",
                            transition: "transform 0.2s ease",
                            display: "inline-block",
                          }}
                        >
                          ▼
                        </span>
                      </Group>
                    }
                    className={classes.menuItem}
                    closeMenuOnClick={false}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLangExpanded((prev) => !prev);
                    }}
                  >
                    {locale === "id" ? "Bahasa" : "Language"}
                  </Menu.Item>

                  {langExpanded ? (
                    <div style={{ paddingLeft: 8, paddingRight: 4, paddingTop: 2, paddingBottom: 2 }}>
                      <Menu.Item
                        leftSection={<span style={{ fontSize: "1.1rem" }}>🇮🇩</span>}
                        rightSection={locale === "id" ? <CheckIcon size={14} /> : null}
                        onClick={() => {
                          setLocale("id");
                          setLangExpanded(false);
                        }}
                        fw={locale === "id" ? 700 : 400}
                        className={classes.menuItem}
                        style={{
                          color: locale === "id" ? "#38bdf8" : "inherit",
                          backgroundColor: locale === "id" ? "rgba(56, 189, 248, 0.12)" : "transparent",
                        }}
                      >
                        Indonesia
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<span style={{ fontSize: "1.1rem" }}>🇬🇧</span>}
                        rightSection={locale === "en" ? <CheckIcon size={14} /> : null}
                        onClick={() => {
                          setLocale("en");
                          setLangExpanded(false);
                        }}
                        fw={locale === "en" ? 700 : 400}
                        className={classes.menuItem}
                        style={{
                          color: locale === "en" ? "#38bdf8" : "inherit",
                          backgroundColor: locale === "en" ? "rgba(56, 189, 248, 0.12)" : "transparent",
                        }}
                      >
                        English
                      </Menu.Item>
                    </div>
                  ) : null}

                  <Menu.Divider style={{ borderColor: "rgba(255, 255, 255, 0.1)" }} />

                  {/* 4. Keluar */}
                  <Menu.Item
                    color="red"
                    leftSection={<LogoutIcon size={16} />}
                    className={classes.menuItem}
                    style={{ color: "#f87171" }}
                    onClick={() => {
                      close();
                      logout.openConfirm();
                    }}
                  >
                    {t("logout")}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </div>
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
