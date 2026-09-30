"use client";

import { Button, Group, Pagination, Paper, Select, Stack, Text } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { EmptyState } from "@/components/empty-state";
import { ItemCard } from "@/components/item-card";
import { auditActionLabel, type AdminAuditItem } from "@/lib/admin";
import type { PaginationMeta } from "@/app/admin/page";
import { formatDateId } from "@/lib/format";

const ACTIONS = [
  { value: "all", label: "Semua aksi" },
  { value: "settings.generate_cooldown_seconds.updated", label: "Ubah jeda generate" },
  { value: "settings.payment.updated", label: "Ubah pengaturan pembayaran" },
  { value: "user.cooldown.reset", label: "Reset jeda generate" },
  { value: "wallet.adjusted", label: "Penyesuaian poin" },
  { value: "invoice.approved", label: "Invoice disetujui" },
  { value: "invoice.rejected", label: "Invoice ditolak" },
  { value: "invoice.admin_canceled", label: "Invoice dibatalkan admin" },
];

function metaText(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  try {
    return JSON.stringify(meta);
  } catch {
    return null;
  }
}

export function AdminAuditList({
  items,
  pagination = {
    page: 1,
    limit: 10,
    total: items.length,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
  currentParams,
}: {
  items: AdminAuditItem[];
  pagination?: PaginationMeta;
  currentParams?: {
    action?: string;
    page?: string;
    limit?: string;
    sortBy?: string;
    sortOrder?: string;
  };
}) {
  const router = useRouter();
  const [actionValue, setActionValue] = useState(currentParams?.action || "all");

  function navigateQuery(overrides: {
    action?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const params = new URLSearchParams();

    const nextAction =
      overrides.action !== undefined ? overrides.action : currentParams?.action || "";
    const nextPage =
      overrides.page !== undefined
        ? String(overrides.page)
        : overrides.action !== undefined || overrides.limit !== undefined
          ? "1"
          : currentParams?.page || "1";
    const nextLimit =
      overrides.limit !== undefined ? String(overrides.limit) : currentParams?.limit || "10";
    const nextSortBy =
      overrides.sortBy !== undefined ? overrides.sortBy : currentParams?.sortBy || "";
    const nextSortOrder =
      overrides.sortOrder !== undefined ? overrides.sortOrder : currentParams?.sortOrder || "";

    if (nextAction && nextAction !== "all") params.set("action", nextAction);
    if (nextPage && nextPage !== "1") params.set("page", nextPage);
    if (nextLimit && nextLimit !== "10") params.set("limit", nextLimit);
    if (nextSortBy) params.set("sortBy", nextSortBy);
    if (nextSortOrder) params.set("sortOrder", nextSortOrder);

    const qs = params.toString();
    router.push(`/admin/audit${qs ? `?${qs}` : ""}`);
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    navigateQuery({ action: actionValue === "all" ? "" : actionValue, page: 1 });
  }

  const startItem = pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Catatan log audit aktivitas admin dan sistem. Log disimpan secara immutable di server.
      </Text>

      <Paper p="sm" withBorder radius="md">
        <form onSubmit={onSearch}>
          <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
            <Group align="flex-end" gap="sm">
              <Select
                size="xs"
                label="Filter Aksi"
                data={ACTIONS}
                value={actionValue}
                onChange={(value) => setActionValue(value ?? "all")}
                w={280}
              />
              <Button size="xs" type="submit" variant="light">
                Filter
              </Button>
            </Group>

            <Select
              size="xs"
              label="Per Halaman"
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
          </Group>
        </form>
      </Paper>

      {items.length === 0 ? (
        <EmptyState minHeight={200}>
          {currentParams?.action
            ? `Tidak ada log audit untuk filter aksi "${currentParams.action}".`
            : "Belum ada jejak audit."}
        </EmptyState>
      ) : null}

      <Stack gap="xs">
        {items.map((item) => {
          const meta = metaText(item.meta);
          return (
            <ItemCard key={item.id}>
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text fw={600} size="sm">
                    {auditActionLabel(item.action)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Aktor: {item.actorEmail ?? item.actorId} {item.ip ? `(${item.ip})` : ""}
                  </Text>
                </div>
                <Text size="xs" c="dimmed" suppressHydrationWarning>
                  {formatDateId(item.createdAt)}
                </Text>
              </Group>

              {item.target ? (
                <Text c="dimmed" size="xs" mt={4}>
                  Target ID: <strong>{item.target}</strong>
                </Text>
              ) : null}

              {meta ? (
                <Text
                  size="xs"
                  c="dimmed"
                  mt={4}
                  style={{
                    fontFamily: "monospace",
                    background: "rgba(255, 255, 255, 0.03)",
                    padding: "4px 8px",
                    borderRadius: 4,
                  }}
                >
                  {meta}
                </Text>
              ) : null}
            </ItemCard>
          );
        })}
      </Stack>

      <Paper p="xs" withBorder radius="md">
        <Group justify="space-between" align="center">
          <Text size="xs" c="dimmed">
            Menampilkan <strong>{startItem}–{endItem}</strong> dari{" "}
            <strong>{pagination.total}</strong> log audit (Halaman {pagination.page} dari{" "}
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
        </Group>
      </Paper>
    </Stack>
  );
}