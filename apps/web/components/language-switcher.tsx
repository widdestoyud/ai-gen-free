"use client";

import { Button, Group, Menu, Text } from "@mantine/core";
import { useI18n } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/port";

export interface LanguageSwitcherProps {
  size?: "xs" | "sm" | "md";
  variant?: "default" | "subtle" | "outline";
  className?: string;
}

function GlobeIcon({ size = 15 }: { size?: number }) {
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

function ChevronDownIcon({ size = 12 }: { size?: number }) {
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
      <polyline points="6 9 12 15 18 9" />
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

/**
 * Reusable Language Switcher component.
 * Displays a trigger button with the active language code ('ID' or 'EN')
 * and opens a dropdown menu to select between 'Indonesia' and 'English'.
 */
export function LanguageSwitcher({
  size = "xs",
  className,
}: LanguageSwitcherProps) {
  const { locale, setLocale } = useI18n();

  const handleSelectLocale = (nextLocale: Locale) => {
    setLocale(nextLocale);
  };

  const buttonHeight = size === "xs" ? 32 : size === "sm" ? 36 : 40;
  const fontSize = size === "xs" ? "0.8rem" : size === "sm" ? "0.875rem" : "1rem";
  const displayLabel = locale === "id" ? "ID" : "EN";

  return (
    <Menu
      shadow="xl"
      width={160}
      position="bottom-end"
      withinPortal
      transitionProps={{ transition: "pop", duration: 150 }}
    >
      <Menu.Target>
        <Button
          size={size}
          variant="subtle"
          color="gray"
          className={className}
          styles={{
            root: {
              padding: "0 10px",
              height: buttonHeight,
              borderRadius: 8,
              background: "rgba(255, 255, 255, 0.07)",
              border: "1px solid rgba(255, 255, 255, 0.16)",
              color: "#f8fafc",
              fontWeight: 600,
              fontSize,
              transition: "all 0.18s ease",
              cursor: "pointer",
              "&:hover": {
                background: "rgba(255, 255, 255, 0.14)",
                borderColor: "rgba(255, 255, 255, 0.3)",
              },
            },
          }}
          aria-label={locale === "id" ? "Pilih Bahasa (ID)" : "Select Language (EN)"}
        >
          <Group gap={6} wrap="nowrap" align="center">
            <GlobeIcon size={size === "xs" ? 14 : 16} />
            <Text component="span" fw={700} fz="inherit">
              {displayLabel}
            </Text>
            <ChevronDownIcon size={10} />
          </Group>
        </Button>
      </Menu.Target>

      <Menu.Dropdown
        style={{
          background: "#0f172a",
          borderColor: "rgba(255, 255, 255, 0.12)",
          padding: 6,
          borderRadius: 10,
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
        }}
      >
        <Menu.Item
          onClick={() => handleSelectLocale("id")}
          leftSection={<span style={{ fontSize: "1.1rem" }}>🇮🇩</span>}
          rightSection={locale === "id" ? <CheckIcon size={13} /> : null}
          fw={locale === "id" ? 700 : 400}
          style={{
            borderRadius: 6,
            color: locale === "id" ? "#38bdf8" : "#e2e8f0",
            backgroundColor: locale === "id" ? "rgba(56, 189, 248, 0.12)" : "transparent",
            fontSize: "0.85rem",
          }}
        >
          Indonesia
        </Menu.Item>

        <Menu.Item
          onClick={() => handleSelectLocale("en")}
          leftSection={<span style={{ fontSize: "1.1rem" }}>🇬🇧</span>}
          rightSection={locale === "en" ? <CheckIcon size={13} /> : null}
          fw={locale === "en" ? 700 : 400}
          style={{
            borderRadius: 6,
            color: locale === "en" ? "#38bdf8" : "#e2e8f0",
            backgroundColor: locale === "en" ? "rgba(56, 189, 248, 0.12)" : "transparent",
            fontSize: "0.85rem",
          }}
        >
          English
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
