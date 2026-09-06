"use client";

import { Image, Text } from "@mantine/core";
import { AppLink } from "./app-link";
import { formatDateId } from "@/lib/format";

export function JobOutput({
  url,
  availableUntil,
  alt = "Hasil generate",
  maw = 480,
}: {
  url: string | null;
  availableUntil?: string | null;
  alt?: string;
  maw?: number;
}) {
  if (!url) {
    return <Text mt="sm">File sudah tidak tersedia.</Text>;
  }
  return (
    <>
      <Image src={url} alt={alt} maw={maw} radius="md" mt="sm" />
      {availableUntil ? (
        <Text c="dimmed">Tersedia sampai {formatDateId(availableUntil)}.</Text>
      ) : null}
      <AppLink href={url} external>
        Unduh
      </AppLink>
    </>
  );
}
