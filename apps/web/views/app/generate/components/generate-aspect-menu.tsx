"use client";

import { Button, Group, Menu, Stack, Text } from "@mantine/core";
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
  const previewClass =
    preview === "tall" ? classes.previewTall : preview === "square" ? classes.previewSquare : classes.previewWide;

  return (
    <Menu position="top-end" shadow="md" width={280}>
      <Menu.Target>
        <Button type="button" variant="light" size="compact-sm" className={classes.ratioChip}>
          {value}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Group align="flex-start" gap="md" p="xs">
          <Stack gap={4} align="center">
            <div className={previewClass} />
            <Text size="xs" c="dimmed">
              {value}
            </Text>
          </Stack>
          <Stack gap={2}>
            {STUDIO_ASPECTS.map((item) => (
              <Menu.Item key={item.value} onClick={() => onChange(item.value)}>
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
