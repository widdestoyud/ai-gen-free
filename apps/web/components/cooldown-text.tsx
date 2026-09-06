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
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!until) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [until]);

  const remaining = remainingSeconds(until, now);
  if (!until || remaining <= 0) return null;

  return (
    <Text>
      {prefix}: <strong>{formatDurationId(remaining)}</strong> (sampai {formatDateId(until)}).
    </Text>
  );
}
