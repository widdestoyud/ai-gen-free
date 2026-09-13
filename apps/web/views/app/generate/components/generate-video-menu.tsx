"use client";

import { Button, Group, Menu, Text, UnstyledButton } from "@mantine/core";
import { CheckIcon, ClockIcon, ResolutionIcon } from "./generate-icons";
import classes from "./generate-studio.module.css";

const DURATIONS: Array<"6s" | "10s" | "15s"> = ["6s", "10s", "15s"];
const RESOLUTIONS: Array<"720p" | "1080p"> = ["720p", "1080p"];

export function GenerateDurationMenu({
  value,
  onChange,
}: {
  value: "6s" | "10s" | "15s";
  onChange: (val: "6s" | "10s" | "15s") => void;
}) {
  return (
    <Menu position="top-end" shadow="md" width={140}>
      <Menu.Target>
        <UnstyledButton className={classes.menuBtn} aria-label="Durasi video">
          <ClockIcon size={14} />
          <span>{value}</span>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        {DURATIONS.map((dur) => (
          <Menu.Item
            key={dur}
            onClick={() => onChange(dur)}
            rightSection={dur === value ? <CheckIcon size={14} /> : null}
          >
            <Text size="sm" fw={dur === value ? 600 : 400}>
              {dur}
            </Text>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

export function GenerateResolutionMenu({
  value,
  onChange,
}: {
  value: "720p" | "1080p";
  onChange: (val: "720p" | "1080p") => void;
}) {
  return (
    <Menu position="top-end" shadow="md" width={140}>
      <Menu.Target>
        <UnstyledButton className={classes.menuBtn} aria-label="Resolusi video">
          <ResolutionIcon size={14} />
          <span>{value}</span>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        {RESOLUTIONS.map((res) => (
          <Menu.Item
            key={res}
            onClick={() => onChange(res)}
            rightSection={res === value ? <CheckIcon size={14} /> : null}
          >
            <Text size="sm" fw={res === value ? 600 : 400}>
              {res}
            </Text>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
