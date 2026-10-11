"use client";

import { Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { formatDate, formatDuration, remainingSeconds } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export function CooldownText({
  until,
  prefix,
}: {
  until?: string | null;
  prefix?: string;
}) {
  const { t, locale } = useI18n("common");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!until) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [until]);

  if (!until) return null;
  const remaining = remainingSeconds(until, now);
  if (remaining <= 0) return null;

  const defaultPrefix = t("cooldown.prefix");
  const activePrefix =
    prefix ||
    (defaultPrefix !== "cooldown.prefix"
      ? defaultPrefix
      : locale === "en"
        ? "Next generation cooldown"
        : "Jeda generate berikutnya");
  const durationText = formatDuration(remaining, locale);
  const dateText = formatDate(until, locale);
  const untilText = locale === "en" ? `until ${dateText}` : `sampai ${dateText}`;

  return (
    <Text suppressHydrationWarning>
      {activePrefix}: <strong>{durationText}</strong> ({untilText}).
    </Text>
  );
}
