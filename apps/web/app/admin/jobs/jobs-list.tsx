"use client";

import { Button, Group, Select, Text, TextInput } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AppLink } from "@/components/app-link";
import { EmptyState } from "@/components/empty-state";
import { ItemCard } from "@/components/item-card";
import { ADMIN_PAGE_SIZE, adminHref, type AdminJobRow } from "@/lib/admin";
import { formatDateId } from "@/lib/format";
import { jobStatusLabel } from "@/lib/job-status";

const STATUSES = [
  { value: "all", label: "Semua status" },
  { value: "queued", label: "Dalam antrean" },
  { value: "running", label: "Sedang generate" },
  { value: "succeeded", label: "Berhasil" },
  { value: "failed", label: "Gagal" },
  { value: "canceled", label: "Dibatalkan" },
];

export function AdminJobsList({
  jobs,
  q,
  status,
  userId,
  offset,
}: {
  jobs: AdminJobRow[];
  q: string;
  status: string;
  userId: string;
  offset: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(q);
  const [statusValue, setStatusValue] = useState(status || "all");

  function onSearch(e: FormEvent) {
    e.preventDefault();
    router.push(
      adminHref("/admin/jobs", {
        q: query.trim(),
        status: statusValue === "all" ? "" : statusValue,
        userId,
      }),
    );
  }

  return (
    <div>
      <Text c="dimmed">Bukan galeri publik. Tidak ada tautan permanen atau tombol bagikan.</Text>
      <form onSubmit={onSearch}>
        <Group align="flex-end" gap="sm" mt="sm" mb="md">
          <TextInput
            label="Email pemilik"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
          <Select
            label="Status"
            data={STATUSES}
            value={statusValue}
            onChange={(value) => setStatusValue(value ?? "all")}
          />
          <Button type="submit">Filter</Button>
        </Group>
      </form>
      {jobs.length === 0 ? <EmptyState>Tidak ada job.</EmptyState> : null}
      {jobs.map((job) => (
        <ItemCard key={job.id}>
          <Text>
            <strong>{job.email}</strong> · {job.mode} · {jobStatusLabel(job.status)}
          </Text>
          <Text lineClamp={2}>{job.promptPreview}</Text>
          <Text size="sm">
            Biaya {job.cost} poin
            {job.purged ? " · file tidak tersedia" : job.status === "succeeded" ? " · file masih ada" : ""}
          </Text>
          <Text c="dimmed" size="sm">
            {formatDateId(job.createdAt)}
            {job.finishedAt ? ` · selesai ${formatDateId(job.finishedAt)}` : ""}
          </Text>
          {job.outputSha256 ? (
            <Text c="dimmed" size="sm">
              sha256 {job.outputSha256.slice(0, 16)}…
            </Text>
          ) : null}
          <AppLink href={`/admin/jobs/${job.id}`}>Detail</AppLink>
        </ItemCard>
      ))}
      <Group gap="sm" mt="sm">
        {offset > 0 ? (
          <AppLink
            href={adminHref("/admin/jobs", {
              q,
              status,
              userId,
              offset: Math.max(0, offset - ADMIN_PAGE_SIZE),
            })}
          >
            Sebelumnya
          </AppLink>
        ) : null}
        {jobs.length >= ADMIN_PAGE_SIZE ? (
          <AppLink href={adminHref("/admin/jobs", { q, status, userId, offset: offset + ADMIN_PAGE_SIZE })}>
            Berikutnya
          </AppLink>
        ) : null}
      </Group>
    </div>
  );
}