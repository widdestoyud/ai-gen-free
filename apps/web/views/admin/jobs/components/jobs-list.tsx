"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  CloseButton,
  Group,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import { AppLink } from "@/components/app-link";
import { EmptyState } from "@/components/empty-state";
import { ADMIN_PAGE_SIZE, adminHref, type AdminJobRow } from "@/lib/admin";
import { formatDateId } from "@/lib/format";
import { jobStatusLabel } from "@/lib/job-status";
import classes from "./jobs-list.module.css";

function DownloadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

const STATUS_OPTIONS = [
  { value: "all", label: "Semua status" },
  { value: "queued", label: "Dalam antrean" },
  { value: "running", label: "Sedang generate" },
  { value: "succeeded", label: "Berhasil" },
  { value: "failed", label: "Gagal" },
  { value: "canceled", label: "Dibatalkan" },
];

const MODE_OPTIONS = [
  { value: "all", label: "Semua mode" },
  { value: "t2i", label: "Text-to-Image (T2I)" },
  { value: "i2i", label: "Image-to-Image (I2I)" },
  { value: "t2v", label: "Text-to-Video (T2V)" },
  { value: "i2v", label: "Image-to-Video (I2V)" },
];

function getStatusBadgeColor(status: string) {
  switch (status) {
    case "succeeded":
      return "teal";
    case "running":
      return "blue";
    case "queued":
      return "yellow";
    case "failed":
      return "red";
    default:
      return "gray";
  }
}

function getModeBadgeColor(mode: string) {
  switch (mode) {
    case "t2i":
      return "blue";
    case "i2i":
      return "indigo";
    case "t2v":
      return "cyan";
    case "i2v":
      return "grape";
    default:
      return "dark";
  }
}

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
  const [modeFilter, setModeFilter] = useState<string | null>("all");

  function onSearch(e: FormEvent) {
    e.preventDefault();
    router.push(
      adminHref("/admin/jobs", {
        q: query.trim(),
        status: statusValue === "all" ? "" : statusValue,
        userId,
        offset: 0,
      }),
    );
  }

  function clearUserFilter() {
    router.push(
      adminHref("/admin/jobs", {
        q: query.trim(),
        status: statusValue === "all" ? "" : statusValue,
        userId: undefined,
        offset: 0,
      }),
    );
  }

  const filteredJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (modeFilter && modeFilter !== "all" && j.mode !== modeFilter) {
        return false;
      }
      return true;
    });
  }, [jobs, modeFilter]);

  function exportCsv() {
    if (filteredJobs.length === 0) return;
    const headers = ["ID", "Email", "Mode", "Model ID", "Status", "Biaya", "Prompt", "Dibuat", "Selesai"];
    const rows = filteredJobs.map((j) => [
      `"${j.id}"`,
      `"${j.email}"`,
      `"${j.mode}"`,
      `"${j.modelId}"`,
      `"${j.status}"`,
      `"${j.cost}"`,
      `"${(j.promptPreview || "").replace(/"/g, '""')}"`,
      `"${formatDateId(j.createdAt)}"`,
      `"${j.finishedAt ? formatDateId(j.finishedAt) : "-"}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `jobs-list-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <Paper className={classes.historyContainer}>
      <div className={classes.headerRow}>
        <Stack gap={2}>
          <Text className={classes.title}>Daftar Job Generate AI</Text>
          <Text className={classes.subtitle}>
            Log eksekusi provider dan render media AI.
          </Text>
        </Stack>

        <form onSubmit={onSearch} className={classes.controls}>
          {userId ? (
            <Badge
              variant="outline"
              color="blue"
              size="md"
              rightSection={<CloseButton size="xs" onClick={clearUserFilter} aria-label="Hapus filter user" />}
            >
              User: {userId.slice(0, 14)}...
            </Badge>
          ) : null}

          <TextInput
            size="xs"
            placeholder="Cari email pemilik..."
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            leftSection={<SearchIcon />}
            className={classes.searchInput}
          />
          <Select
            size="xs"
            value={statusValue}
            onChange={(val) => setStatusValue(val ?? "all")}
            data={STATUS_OPTIONS}
            className={classes.selectInput}
            allowDeselect={false}
          />
          <Select
            size="xs"
            value={modeFilter}
            onChange={setModeFilter}
            data={MODE_OPTIONS}
            className={classes.selectInput}
            allowDeselect={false}
          />
          <Button size="xs" type="submit" variant="light">
            Filter
          </Button>
          <Button
            size="xs"
            variant="default"
            leftSection={<DownloadIcon />}
            onClick={exportCsv}
            disabled={filteredJobs.length === 0}
          >
            Export CSV
          </Button>
        </form>
      </div>

      {filteredJobs.length === 0 ? (
        <EmptyState minHeight={220}>
          {q || status || userId ? "Tidak ada job yang sesuai dengan filter pencarian." : "Belum ada job generate."}
        </EmptyState>
      ) : (
        <Table verticalSpacing="sm" horizontalSpacing="md">
          <Table.Thead className={classes.tableHeader}>
            <Table.Tr>
              <Table.Th>Pemilik / Email</Table.Th>
              <Table.Th>Prompt & Model</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Biaya</Table.Th>
              <Table.Th>Waktu Dibuat</Table.Th>
              <Table.Th className={classes.actionCell}>Aksi</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredJobs.map((job) => {
              const statusColor = getStatusBadgeColor(job.status);
              const modeColor = getModeBadgeColor(job.mode);
              const statusText = jobStatusLabel(job.status);

              return (
                <Table.Tr key={job.id} className={classes.tableRow}>
                  <Table.Td>
                    <div className={classes.userCell}>
                      <span className={classes.userEmail} title={job.email}>
                        {job.email}
                      </span>
                      <span className={classes.jobIdText}>ID: {job.id}</span>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <div className={classes.promptCell}>
                      <Text lineClamp={2} className={classes.promptText} title={job.promptPreview}>
                        {job.promptPreview || "—"}
                      </Text>
                      <div className={classes.modelMeta}>
                        <Badge variant="light" color={modeColor} size="xs" radius="sm">
                          {job.mode.toUpperCase()}
                        </Badge>
                        <span className={classes.modelIdText}>{job.modelId}</span>
                      </div>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={statusColor} size="sm" radius="sm">
                      {statusText}
                    </Badge>
                  </Table.Td>
                  <Table.Td className={classes.costCell}>
                    {job.cost} Poin
                  </Table.Td>
                  <Table.Td className={classes.dateCell}>
                    <Tooltip
                      label={job.finishedAt ? `Selesai: ${formatDateId(job.finishedAt)}` : "Belum selesai"}
                      withArrow
                    >
                      <span>{formatDateId(job.createdAt)}</span>
                    </Tooltip>
                  </Table.Td>
                  <Table.Td className={classes.actionCell}>
                    <Button
                      component={AppLink}
                      href={`/admin/jobs/${job.id}`}
                      variant="light"
                      size="xs"
                      radius="md"
                    >
                      Detail
                    </Button>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <div className={classes.paginationRow}>
        <Text size="xs" c="dimmed">
          Menampilkan {filteredJobs.length} job (Halaman {Math.floor(offset / ADMIN_PAGE_SIZE) + 1})
        </Text>
        <Group gap="xs">
          {offset > 0 ? (
            <Button
              component={AppLink}
              href={adminHref("/admin/jobs", {
                q,
                status,
                userId,
                offset: Math.max(0, offset - ADMIN_PAGE_SIZE),
              })}
              variant="default"
              size="xs"
            >
              Sebelumnya
            </Button>
          ) : null}
          {jobs.length >= ADMIN_PAGE_SIZE ? (
            <Button
              component={AppLink}
              href={adminHref("/admin/jobs", {
                q,
                status,
                userId,
                offset: offset + ADMIN_PAGE_SIZE,
              })}
              variant="default"
              size="xs"
            >
              Berikutnya
            </Button>
          ) : null}
        </Group>
      </div>
    </Paper>
  );
}