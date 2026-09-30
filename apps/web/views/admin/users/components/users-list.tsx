"use client";

import { useState, type FormEvent } from "react";
import {
  Badge,
  Button,
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
import type { AdminUserRow } from "@/lib/admin";
import type { PaginationMeta } from "@/app/admin/page";
import { formatDateId } from "@/lib/format";
import classes from "./users-list.module.css";

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

export function AdminUsersList({
  users,
  pagination = {
    page: 1,
    limit: 10,
    total: users.length,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
  currentParams,
}: {
  users: AdminUserRow[];
  pagination?: PaginationMeta;
  currentParams?: {
    q?: string;
    role?: string;
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
    role?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }) {
    const params = new URLSearchParams();

    const nextQ = overrides.q !== undefined ? overrides.q : currentParams?.q || "";
    const nextRole = overrides.role !== undefined ? overrides.role : currentParams?.role || "";
    const nextPage =
      overrides.page !== undefined
        ? String(overrides.page)
        : overrides.q !== undefined || overrides.role !== undefined || overrides.limit !== undefined
          ? "1"
          : currentParams?.page || "1";
    const nextLimit =
      overrides.limit !== undefined ? String(overrides.limit) : currentParams?.limit || "10";
    const nextSortBy =
      overrides.sortBy !== undefined ? overrides.sortBy : currentParams?.sortBy || "";
    const nextSortOrder =
      overrides.sortOrder !== undefined ? overrides.sortOrder : currentParams?.sortOrder || "";

    if (nextQ.trim()) params.set("q", nextQ.trim());
    if (nextRole && nextRole !== "all") params.set("role", nextRole);
    if (nextPage && nextPage !== "1") params.set("page", nextPage);
    if (nextLimit && nextLimit !== "10") params.set("limit", nextLimit);
    if (nextSortBy) params.set("sortBy", nextSortBy);
    if (nextSortOrder) params.set("sortOrder", nextSortOrder);

    const qs = params.toString();
    router.push(`/admin/users${qs ? `?${qs}` : ""}`);
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    navigateQuery({ q: query.trim(), page: 1 });
  }

  function exportCsv() {
    if (users.length === 0) return;
    const headers = [
      "ID",
      "Email",
      "Role",
      "Saldo Tersedia",
      "Saldo Terkunci",
      "Jeda Sampai",
      "Terdaftar",
    ];
    const rows = users.map((u) => [
      `"${u.id}"`,
      `"${u.email}"`,
      `"${u.role}"`,
      `"${u.available}"`,
      `"${u.held}"`,
      `"${u.nextGenerateAt ? formatDateId(u.nextGenerateAt) : "-"}"`,
      `"${formatDateId(u.createdAt)}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `users-list-${new Date().toISOString().slice(0, 10)}.csv`);
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
          <Text className={classes.title}>Daftar Pengguna</Text>
          <Text className={classes.subtitle}>
            Saldo dan data pengguna diambil dari database query layer terpusat.
          </Text>
        </Stack>

        <form onSubmit={onSearch} className={classes.controls}>
          <TextInput
            size="xs"
            placeholder="Cari email pengguna..."
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            leftSection={<SearchIcon />}
            className={classes.searchInput}
          />
          <Select
            size="xs"
            value={currentParams?.role ?? "all"}
            onChange={(role) => navigateQuery({ role: role ?? "all", page: 1 })}
            data={[
              { value: "all", label: "Semua role" },
              { value: "customer", label: "Customer" },
              { value: "admin", label: "Admin" },
            ]}
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
            Cari
          </Button>
          <Button
            size="xs"
            variant="default"
            leftSection={<DownloadIcon />}
            onClick={exportCsv}
            disabled={users.length === 0}
          >
            Export CSV
          </Button>
        </form>
      </div>

      {users.length === 0 ? (
        <EmptyState minHeight={220}>
          {currentParams?.q
            ? `Tidak ada pengguna yang cocok dengan pencarian "${currentParams.q}".`
            : "Belum ada data pengguna."}
        </EmptyState>
      ) : (
        <ResponsiveTable
          data={users}
          keyExtractor={(user) => user.id}
          renderHeader={() => (
            <Table.Tr className={classes.tableHeader}>
              <Table.Th>Pengguna</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Saldo Poin</Table.Th>
              <Table.Th>Jeda Generate</Table.Th>
              <Table.Th>Terdaftar</Table.Th>
              <Table.Th className={classes.actionCell}>Aksi</Table.Th>
            </Table.Tr>
          )}
          renderRow={(user) => {
            const isCooldown = Boolean(
              user.nextGenerateAt && new Date(user.nextGenerateAt).getTime() > Date.now(),
            );

            return (
              <Table.Tr key={user.id} className={classes.tableRow}>
                <Table.Td>
                  <div className={classes.userCell}>
                    <span className={classes.userEmail}>{user.email}</span>
                    <span className={classes.userIdText}>ID: {user.id}</span>
                  </div>
                </Table.Td>
                <Table.Td>
                  <Badge
                    variant="light"
                    color={user.role === "admin" ? "violet" : "blue"}
                    size="sm"
                    radius="sm"
                  >
                    {user.role}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <div className={classes.balanceCell}>
                    <span className={classes.balanceValue}>{user.available} Poin</span>
                    {user.held > 0 ? (
                      <span className={classes.heldValue}>({user.held} terkunci)</span>
                    ) : null}
                  </div>
                </Table.Td>
                <Table.Td>
                  {isCooldown ? (
                    <Tooltip
                      label={`Jeda sampai: ${formatDateId(user.nextGenerateAt!)}`}
                      withArrow
                    >
                      <Badge variant="light" color="yellow" size="sm" radius="sm">
                        Jeda Generate
                      </Badge>
                    </Tooltip>
                  ) : (
                    <Badge variant="light" color="teal" size="sm" radius="sm">
                      Siap Generate
                    </Badge>
                  )}
                </Table.Td>
                <Table.Td className={classes.dateCell} suppressHydrationWarning>
                  {formatDateId(user.createdAt)}
                </Table.Td>
                <Table.Td className={classes.actionCell}>
                  <Button
                    component={AppLink}
                    href={`/admin/users/${user.id}`}
                    variant="light"
                    size="xs"
                    radius="md"
                  >
                    Kelola
                  </Button>
                </Table.Td>
              </Table.Tr>
            );
          }}
          renderMobileCard={(user) => {
            const isCooldown = Boolean(
              user.nextGenerateAt && new Date(user.nextGenerateAt).getTime() > Date.now(),
            );

            return (
              <div
                key={user.id}
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
                      {user.email}
                    </Text>
                    <Text size="xs" c="dimmed" style={{ fontFamily: "monospace" }}>
                      ID: {user.id}
                    </Text>
                  </div>
                  <Badge
                    variant="light"
                    color={user.role === "admin" ? "violet" : "blue"}
                    size="sm"
                    radius="sm"
                  >
                    {user.role}
                  </Badge>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <div>
                    <Text size="xs" c="dimmed">
                      Saldo Poin
                    </Text>
                    <Text size="sm" fw={700} c="blue.4">
                      {user.available} Poin{" "}
                      {user.held > 0 && (
                        <Text span size="xs" c="dimmed">
                          ({user.held} lock)
                        </Text>
                      )}
                    </Text>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <Text size="xs" c="dimmed">
                      Status Generate
                    </Text>
                    {isCooldown ? (
                      <Badge variant="light" color="yellow" size="xs" radius="sm">
                        Jeda
                      </Badge>
                    ) : (
                      <Badge variant="light" color="teal" size="xs" radius="sm">
                        Siap
                      </Badge>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text size="xs" c="dimmed" suppressHydrationWarning>
                    Daftar: {formatDateId(user.createdAt)}
                  </Text>
                  <Button
                    component={AppLink}
                    href={`/admin/users/${user.id}`}
                    variant="light"
                    size="xs"
                    radius="md"
                  >
                    Kelola Pengguna
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
          <strong>{pagination.total}</strong> pengguna (Halaman {pagination.page} dari{" "}
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