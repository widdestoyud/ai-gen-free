"use client";

import { Image, Text } from "@mantine/core";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { ItemCard } from "@/components/item-card";
import { formatDateId } from "@/lib/format";
import { jobErrorMessage, jobStatusLabel } from "@/lib/job-status";
import type { AdminJobDetailView } from "@/lib/admin";

function paramsText(params: unknown): string | null {
  if (!params || typeof params !== "object") return null;
  try {
    return JSON.stringify(params);
  } catch {
    return null;
  }
}

export function AdminJobDetail({ job }: { job: AdminJobDetailView }) {
  const [fileMissing, setFileMissing] = useState(job.purged);
  const fileHref = `/api/admin/jobs/${job.id}/file`;
  const live = job.status === "succeeded" && !job.purged && !fileMissing;
  const params = paramsText(job.params);

  return (
    <div>
      <ItemCard>
        <Text>
          <strong>{job.email}</strong> · {job.mode} · {jobStatusLabel(job.status)}
        </Text>
        <Text>{job.prompt}</Text>
        {params ? (
          <Text c="dimmed" size="sm">
            Param: {params}
          </Text>
        ) : null}
        <Text size="sm">
          Model {job.modelId} · biaya {job.cost} poin
        </Text>
        {job.createdAt ? (
          <Text c="dimmed" size="sm">
            Dibuat: {formatDateId(job.createdAt)}
          </Text>
        ) : null}
        {job.finishedAt ? (
          <Text c="dimmed" size="sm">
            Selesai: {formatDateId(job.finishedAt)}
          </Text>
        ) : null}
        {job.outputSha256 ? (
          <Text c="dimmed" size="sm">
            sha256 {job.outputSha256}
          </Text>
        ) : null}
        {job.status === "failed" ? <Text>{jobErrorMessage(job.errorCode)}</Text> : null}
        <AppLink href={`/admin/users/${job.userId}`}>Buka user</AppLink>
      </ItemCard>
      {job.status === "succeeded" ? (
        <ItemCard>
          {live ? (
            <>
              <Text c="dimmed">Pratinjau lewat sesi admin. Bukan tautan permanen.</Text>
              {job.output?.contentType?.startsWith("image/") ? (
                <Image
                  src={fileHref}
                  alt="Hasil generate"
                  radius="md"
                  maw={480}
                  onError={() => setFileMissing(true)}
                />
              ) : null}
              <AppLink href={fileHref} external>
                Buka file
              </AppLink>
              {job.output?.availableUntil ? (
                <Text c="dimmed" size="sm">
                  Tersedia sampai {formatDateId(job.output.availableUntil)}.
                </Text>
              ) : null}
            </>
          ) : (
            <Text>File sudah tidak tersedia.</Text>
          )}
        </ItemCard>
      ) : null}
    </div>
  );
}