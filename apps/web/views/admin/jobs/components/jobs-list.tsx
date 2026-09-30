"use client";

import { useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  CloseButton,
  Group,
  Pagination,
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
import { ResponsiveTable } from "@/components/responsive-table";
import { EmptyState } from "@/components/empty-state";
import type { AdminJobRow } from "@/lib/admin";
import type { PaginationMeta } from "@/app/admin/page";
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
  pagination = {
    page: 1,
    limit: 10,
    total: jobs.length,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
  currentParams,
}: {
  jobs: AdminJobRow[];
  pagination?: PaginationMeta;
  currentParams?: {
    q?: string;
    status?: string;
    mode?: string;
    userId?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: string;
  };
}) {
  const router = useRouter();
  const [query, setQuery] = useState(currentParams?.q ?? "");

  function navigateQuery(overrides: {
    q?: string;
    status?: string;
    mode?: string;
    userId?: string | null;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const params = new URLSearchParams();

    const nextQ = overrides.q !== undefined ? overrides.q : currentParams?.q || "";
    const nextStatus =
      overrides.status !== undefined ? overrides.status : currentParams?.status || "";
    const nextMode = overrides.mode !== undefined ? overrides.mode : currentParams?.mode || "";
    const nextUserId =
      overrides.userId !== undefined
        ? overrides.userId
        : currentParams?.userId !== undefined
          ? currentParams.userId
          : "";
    const nextPage =
      overrides.page !== undefined
        ? String(overrides.page)
        : overrides.q !== undefined ||
            overrides.status !== undefined ||
            overrides.mode !== undefined ||
            overrides.limit !== undefined
          ? "1"
          : currentParams?.page || "1";
    const nextLimit =
      overrides.limit !== undefined ? String(overrides.limit) : currentParams?.limit || "10";
    const nextSortBy =
      overrides.sortBy !== undefined ? overrides.sortBy : currentParams?.sortBy || "";
    const nextSortOrder =
      overrides.sortOrder !== undefined ? overrides.sortOrder : currentParams?.sortOrder || "";

    if (nextQ.trim()) params.set("q", nextQ.trim());
    if (nextStatus && nextStatus !== "all") params.set("status", nextStatus);
    if (nextMode && nextMode !== "all") params.set("mode", nextMode);
    if (nextUserId) params.set("userId", nextUserId);
    if (nextPage && nextPage !== "1") params.set("page", nextPage);
    if (nextLimit && nextLimit !== "10") params.set("limit", nextLimit);
    if (nextSortBy) params.set("sortBy", nextSortBy);
    if (nextSortOrder) params.set("sortOrder", nextSortOrder);

    const qs = params.toString();
    router.push(`/admin/jobs${qs ? `?${qs}` : ""}`);
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    navigateQuery({ q: query.trim(), page: 1 });
  }

  function clearUserFilter() {
    navigateQuery({ userId: null, page: 1 });
  }

  function exportCsv() {
    if (jobs.length === 0) return;
    const headers = [
      "ID",
      "Email",
      "Mode",
      "Model ID",
      "Status",
      "Biaya",
      "Prompt",
      "Dibuat",
      "Selesai",
    ];
    const rows = jobs.map((j) => [
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

  const startItem = pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <Paper className={classes.historyContainer}>
      <div className={classes.headerRow}>
        <Stack gap={2}>
          <Text className={classes.title}>Daftar Job Generate AI</Text>
          <Text className={classes.subtitle}>
            Monitoring eksekusi dan riwayat render media AI terpusat.
          </Text>
        </Stack>

        <form onSubmit={onSearch} className={classes.controls}>
          {currentParams?.userId ? (
            <Badge
              variant="outline"
              color="blue"
              size="md"
              rightSection={
                <CloseButton size="xs" onClick={clearUserFilter} aria-label="Hapus filter user" />
              }
            >
              User: {currentParams.userId.slice(0, 14)}...
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
            value={currentParams?.status ?? "all"}
            onChange={(val) => navigateQuery({ status: val ?? "all", page: 1 })}
            data={STATUS_OPTIONS}
            className={classes.selectInput}
            allowDeselect={false}
          />
          <Select
            size="xs"
            value={currentParams?.mode ?? "all"}
            onChange={(val) => navigateQuery({ mode: val ?? "all", page: 1 })}
            data={MODE_OPTIONS}
            className={classes.selectInput}
            allowDeselect={false}
          />
          <Select
            size="xs"
            w={110}
            value={String(pagination.limit)}
            onChange={(val) => val && navigateQuery({ limit: parseInt(val, 10), page: 1 })}
            data={[
              { value: "10", label: "10 / hal" },
              { value: "20", label: "20 / hal" },
              { value: "50", label: "50 / hal" },
              { value: "100", label: "100 / hal" },
            ]}
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
            disabled={jobs.length === 0}
          >
            Export CSV
          </Button>
        </form>
      </div>

      {jobs.length === 0 ? (
        <EmptyState minHeight={220}>
          {currentParams?.q ||
          currentParams?.status ||
          currentParams?.mode ||
          currentParams?.userId
            ? "Tidak ada job yang sesuai dengan filter pencarian."
            : "Belum ada job generate."}
        </EmptyState>
      ) : (
        <ResponsiveTable
          data={jobs}
          keyExtractor={(job) => job.id}
          renderHeader={() => (
            <Table.Tr className={classes.tableHeader}>
              <Table.Th>Pemilik / Email</Table.Th>
              <Table.Th>Prompt & Model</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Biaya</Table.Th>
              <Table.Th>Waktu Dibuat</Table.Th>
              <Table.Th className={classes.actionCell}>Aksi</Table.Th>
            </Table.Tr>
          )}
          renderRow={(job) => {
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
                <Table.Td className={classes.costCell}>{job.cost} Poin</Table.Td>
                <Table.Td className={classes.dateCell} suppressHydrationWarning>
                  <Tooltip
                    label={
                      job.finishedAt
                        ? `Selesai: ${formatDateId(job.finishedAt)}`
                        : "Belum selesai"
                    }
                    withArrow
                  >
                    <span suppressHydrationWarning>{formatDateId(job.createdAt)}</span>
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
          }}
          renderMobileCard={(job) => {
            const statusColor = getStatusBadgeColor(job.status);
            const modeColor = getModeBadgeColor(job.mode);
            const statusText = jobStatusLabel(job.status);

            return (
              <div
                key={job.id}
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid var(--mantine-color-default-border)",
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <div>
                    <Text fw={600} size="sm">
                      {job.email}
                    </Text>
                    <Text size="xs" c="dimmed" style={{ fontFamily: "monospace" }}>
                      ID: {job.id}
                    </Text>
                  </div>
                  <Group gap={6}>
                    <Badge variant="light" color={modeColor} size="xs" radius="sm">
                      {job.mode.toUpperCase()}
                    </Badge>
                    <Badge variant="light" color={statusColor} size="xs" radius="sm">
                      {statusText}
                    </Badge>
                  </Group>
                </div>

                <div
                  style={{
                    padding: "8px 0",
                    borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <Text size="xs" c="dimmed" mb={2}>
                    Prompt & Model ({job.modelId}):
                  </Text>
                  <Text size="xs" lineClamp={2} style={{ color: "var(--mantine-color-text)" }}>
                    {job.promptPreview || "—"}
                  </Text>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <Text size="xs" c="dimmed">
                      Biaya & Waktu
                    </Text>
                    <Text size="xs" fw={600} suppressHydrationWarning>
                      {job.cost} Poin • {formatDateId(job.createdAt)}
                    </Text>
                  </div>
                  <Button
                    component={AppLink}
                    href={`/admin/jobs/${job.id}`}
                    variant="light"
                    size="xs"
                    radius="md"
                  >
                    Detail
                  </Button>
                </div>
              </div>
            );
          }}
        />
      )}

      <div className={classes.paginationRow}>
        <Text size="xs" c="dimmed">
          Menampilkan <strong>{startItem}–{endItem}</strong> dari{" "}
          <strong>{pagination.total}</strong> job (Halaman {pagination.page} dari{" "}
          {pagination.totalPages}).
        </Text>

        {pagination.totalPages > 1 && (
          <Pagination
            size="sm"
            total={pagination.totalPages}
            value={pagination.page}
            onChange={(newPage) => navigateQuery({ page: newPage })}
          />
        )}
      </div>
    </Paper>
  );
}