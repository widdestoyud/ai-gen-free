"use client";

import { useState } from "react";
import { Group, Menu, Stack, Text, UnstyledButton } from "@mantine/core";
import { STUDIO_ASPECTS } from "@/hooks/use-generate-studio";
import classes from "./generate-studio.module.css";

export function GenerateAspectMenu({
  value,
  preview,
  onChange,
}: {
  value: string;
  preview: string;
  onChange: (value: string) => void;
}) {
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);

  const activeAspect =
    (hoveredValue ? STUDIO_ASPECTS.find((item) => item.value === hoveredValue) : null) ??
    STUDIO_ASPECTS.find((item) => item.value === value);

  const displayPreview = activeAspect?.preview ?? preview;
  const displayValue = activeAspect?.value ?? value;

  const previewClass =
    displayPreview === "tall"
      ? classes.previewTall
      : displayPreview === "square"
        ? classes.previewSquare
        : classes.previewWide;

  return (
    <Menu position="top-end" shadow="md" width={280} onClose={() => setHoveredValue(null)}>
      <Menu.Target>
        <UnstyledButton className={classes.menuBtn} aria-label="Rasio aspek">
          <span>{value}</span>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown onMouseLeave={() => setHoveredValue(null)}>
        <Group align="flex-start" gap="md" p="xs">
          <Stack gap={4} align="center" w={90}>
            <div className={classes.previewContainer}>
              <div className={previewClass} />
            </div>
            <Text size="xs" c="dimmed">
              {displayValue}
            </Text>
          </Stack>
          <Stack gap={2}>
            {STUDIO_ASPECTS.map((item) => (
              <Menu.Item
                key={item.value}
                onMouseEnter={() => setHoveredValue(item.value)}
                onClick={() => {
                  onChange(item.value);
                  setHoveredValue(null);
                }}
              >
                <Text size="sm" fw={item.value === value ? 700 : 400}>
                  {item.label}
                </Text>
              </Menu.Item>
            ))}
          </Stack>
        </Group>
      </Menu.Dropdown>
    </Menu>
  );
}
