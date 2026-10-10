"use client";

import { Button, Group, Menu, Tooltip } from "@mantine/core";
import { useI18n } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/port";

interface LanguageSwitcherProps {
  variant?: "menu" | "toggle" | "button";
  size?: "xs" | "sm" | "md";
}

function GlobeIcon({ size = 14 }: { size?: number }) {
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

export function LanguageSwitcher({ variant = "toggle", size = "xs" }: LanguageSwitcherProps) {
  const { locale, setLocale } = useI18n();

  const toggleLanguage = () => {
    const nextLocale: Locale = locale === "id" ? "en" : "id";
    setLocale(nextLocale);
  };

  if (variant === "toggle") {
    return (
      <Tooltip label={locale === "id" ? "Switch to English (EN)" : "Ganti ke Bahasa Indonesia (ID)"} withArrow position="bottom">
        <Button
          size={size}
          variant="subtle"
          color="gray"
          onClick={toggleLanguage}
          styles={{
            root: {
              padding: "0 10px",
              height: size === "xs" ? 30 : 34,
              borderRadius: 8,
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              color: "#f1f5f9",
              fontWeight: 600,
              fontSize: size === "xs" ? "0.8rem" : "0.875rem",
              transition: "all 0.15s ease",
              cursor: "pointer",
              "&:hover": {
                background: "rgba(255, 255, 255, 0.12)",
                borderColor: "rgba(255, 255, 255, 0.25)",
              },
            },
          }}
          aria-label={locale === "id" ? "Ganti ke Bahasa Inggris" : "Switch to Indonesian"}
        >
          <Group gap={6} wrap="nowrap" align="center">
            <GlobeIcon size={14} />
            <span>{locale === "id" ? "ID" : "EN"}</span>
          </Group>
        </Button>
      </Tooltip>
    );
  }

  return (
    <Menu shadow="md" width={160} position="bottom-end">
      <Menu.Target>
        <Button
          size={size}
          variant="subtle"
          color="gray"
          styles={{
            root: {
              padding: "0 10px",
              height: size === "xs" ? 30 : 34,
              borderRadius: 8,
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.14)",
              color: "#f1f5f9",
              fontWeight: 600,
            },
          }}
        >
          <Group gap={6} wrap="nowrap" align="center">
            <GlobeIcon size={14} />
            <span>{locale === "id" ? "Bahasa Indonesia" : "English"}</span>
          </Group>
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item
          onClick={() => setLocale("id")}
          leftSection={<span>🇮🇩</span>}
          fw={locale === "id" ? 700 : 400}
        >
          Bahasa Indonesia (ID)
        </Menu.Item>
        <Menu.Item
          onClick={() => setLocale("en")}
          leftSection={<span>🇬🇧</span>}
          fw={locale === "en" ? 700 : 400}
        >
          English (EN)
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
