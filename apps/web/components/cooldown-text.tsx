"use client";

import { Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { formatDateId, formatDurationId, remainingSeconds } from "@/lib/format";

export function CooldownText({
  until,
  prefix = "Jeda generate berikutnya",
}: {
  until?: string | null;
  prefix?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setMounted(true);
    if (!until) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [until]);

  if (!mounted || !until) return null;
  const remaining = remainingSeconds(until, now);
  if (remaining <= 0) return null;

  return (
    <Text suppressHydrationWarning>
      {prefix}: <strong>{formatDurationId(remaining)}</strong> (sampai {formatDateId(until)}).
    </Text>
  );
}
