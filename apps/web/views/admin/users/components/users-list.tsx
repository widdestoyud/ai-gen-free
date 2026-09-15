"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Badge,
  Button,
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
import { ADMIN_PAGE_SIZE, adminHref, type AdminUserRow } from "@/lib/admin";
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
  q,
  offset,
}: {
  users: AdminUserRow[];
  q: string;
  offset: number;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(q);
  const [roleFilter, setRoleFilter] = useState<string | null>("all");
  const [statusFilter, setStatusFilter] = useState<string | null>("all");

  function onSearch(e: FormEvent) {
    e.preventDefault();
    router.push(adminHref("/admin/users", { q: query.trim(), offset: 0 }));
  }

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter && roleFilter !== "all" && u.role !== roleFilter) {
        return false;
      }
      if (statusFilter && statusFilter !== "all") {
        const isCooldownActive = Boolean(u.nextGenerateAt && new Date(u.nextGenerateAt).getTime() > Date.now());
        if (statusFilter === "cooldown" && !isCooldownActive) return false;
        if (statusFilter === "ready" && isCooldownActive) return false;
      }
      return true;
    });
  }, [users, roleFilter, statusFilter]);

  function exportCsv() {
    if (filteredUsers.length === 0) return;
    const headers = ["ID", "Email", "Role", "Saldo Tersedia", "Saldo Terkunci", "Jeda Sampai", "Terdaftar"];
    const rows = filteredUsers.map((u) => [
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

  return (
    <Paper className={classes.historyContainer}>
      <div className={classes.headerRow}>
        <Stack gap={2}>
          <Text className={classes.title}>Daftar Pengguna</Text>
          <Text className={classes.subtitle}>
            Saldo dan data pengguna diambil dari ledger server terpusat.
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
            value={roleFilter}
            onChange={setRoleFilter}
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
            value={statusFilter}
            onChange={setStatusFilter}
            data={[
              { value: "all", label: "Semua status" },
              { value: "ready", label: "Siap generate" },
              { value: "cooldown", label: "Sedang jeda" },
            ]}
            className={classes.selectInput}
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
            disabled={filteredUsers.length === 0}
          >
            Export CSV
          </Button>
        </form>
      </div>

      {filteredUsers.length === 0 ? (
        <EmptyState minHeight={220}>
          {q ? `Tidak ada pengguna yang cocok dengan pencarian "${q}".` : "Belum ada data pengguna."}
        </EmptyState>
      ) : (
        <Table verticalSpacing="sm" horizontalSpacing="md">
          <Table.Thead className={classes.tableHeader}>
            <Table.Tr>
              <Table.Th>Pengguna</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Saldo Poin</Table.Th>
              <Table.Th>Jeda Generate</Table.Th>
              <Table.Th>Terdaftar</Table.Th>
              <Table.Th className={classes.actionCell}>Aksi</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredUsers.map((user) => {
              const isCooldown = Boolean(user.nextGenerateAt && new Date(user.nextGenerateAt).getTime() > Date.now());

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
                      <Tooltip label={`Jeda sampai: ${formatDateId(user.nextGenerateAt!)}`} withArrow>
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
                  <Table.Td className={classes.dateCell}>
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
            })}
          </Table.Tbody>
        </Table>
      )}

      <div className={classes.paginationRow}>
        <Text size="xs" c="dimmed">
          Menampilkan {filteredUsers.length} pengguna (Halaman {Math.floor(offset / ADMIN_PAGE_SIZE) + 1})
        </Text>
        <Group gap="xs">
          {offset > 0 ? (
            <Button
              component={AppLink}
              href={adminHref("/admin/users", { q, offset: Math.max(0, offset - ADMIN_PAGE_SIZE) })}
              variant="default"
              size="xs"
            >
              Sebelumnya
            </Button>
          ) : null}
          {users.length >= ADMIN_PAGE_SIZE ? (
            <Button
              component={AppLink}
              href={adminHref("/admin/users", { q, offset: offset + ADMIN_PAGE_SIZE })}
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