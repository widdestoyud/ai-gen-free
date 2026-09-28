"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Badge,
  Button,
  Code,
  Collapse,
  Group,
  Paper,
  Select,
  Stack,
  Table,
  Text,
} from "@mantine/core";
import { ItemCard } from "@/components/item-card";
import { EmptyState } from "@/components/empty-state";
import { requestJson } from "@/lib/api";
import { formatDateId } from "@/lib/format";
import { activityActionLabel, type UserActivityItem } from "@/lib/admin";

const FILTER_ACTIONS = [
  { value: "all", label: "Semua Aktivitas" },
  { value: "auth", label: "Login & Otentikasi (auth.*)" },
  { value: "generate", label: "Generate Studio (generate.*)" },
  { value: "upload", label: "Unggah Media (upload.*)" },
  { value: "billing", label: "Beli Koin & Billing (billing.*)" },
  { value: "profile", label: "Perubahan Profil (profile.*)" },
];

function getActionBadgeColor(action: string): string {
  if (action.startsWith("auth.")) return "blue";
  if (action.startsWith("generate.")) return "violet";
  if (action.startsWith("upload.")) return "teal";
  if (action.startsWith("billing.")) return "green";
  if (action.startsWith("profile.")) return "orange";
  return "gray";
}

function formatLocation(item: UserActivityItem): string {
  const parts: string[] = [];
  if (item.city) parts.push(item.city);
  if (item.region && item.region !== item.city) parts.push(item.region);
  if (item.country) parts.push(item.country);
  return parts.length > 0 ? parts.join(", ") : "-";
}

function formatDevice(item: UserActivityItem): string {
  const parts: string[] = [];
  if (item.os) parts.push(item.os);
  if (item.browser) parts.push(item.browser);
  if (item.deviceType && item.deviceType !== "desktop") parts.push(`(${item.deviceType})`);
  return parts.length > 0 ? parts.join(" · ") : "-";
}

export function UserActivityTable({ userId }: { userId: string }) {
  const [items, setItems] = useState<UserActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filterAction, setFilterAction] = useState("all");
  const [offset, setOffset] = useState(0);
  const [expandedMetaId, setExpandedMetaId] = useState<string | null>(null);
  const limit = 15;

  const loadActivities = useCallback(async () => {
    setLoading(true);
    const actionQuery = filterAction !== "all" ? `&action=${encodeURIComponent(filterAction)}` : "";
    const res = await requestJson<{
      items: UserActivityItem[];
      total: number;
      limit: number;
      offset: number;
    }>(`/api/admin/users/${userId}/activities?limit=${limit}&offset=${offset}${actionQuery}`);

    setLoading(false);
    if (res.ok && res.data) {
      setItems(res.data.items);
      setTotal(res.data.total);
    }
  }, [userId, filterAction, offset]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  return (
    <ItemCard>
      <Group justify="space-between" align="center" mb="sm">
        <div>
          <Text fw={600} size="lg">
            Riwayat Aktivitas Pengguna (Server Log)
          </Text>
          <Text c="dimmed" size="sm">
            Dicatat 100% dari sisi server: IP, ISP/Provider, OS/Browser, dan Lokasi pelanggan.
          </Text>
        </div>
        <Select
          size="xs"
          data={FILTER_ACTIONS}
          value={filterAction}
          onChange={(val) => {
            setFilterAction(val ?? "all");
            setOffset(0);
          }}
        />
      </Group>

      {loading && items.length === 0 ? (
        <Text c="dimmed" size="sm" py="md">
          Memuat riwayat aktivitas…
        </Text>
      ) : items.length === 0 ? (
        <EmptyState>Belum ada riwayat aktivitas yang tercatat untuk filter ini.</EmptyState>
      ) : (
        <Stack gap="xs">
          <Paper withBorder radius="sm" p={0}>
            <Table striped highlightOnHover verticalSpacing="xs" fz="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Waktu</Table.Th>
                  <Table.Th>Aksi</Table.Th>
                  <Table.Th>IP &amp; ISP / Provider</Table.Th>
                  <Table.Th>OS / Perangkat</Table.Th>
                  <Table.Th>Lokasi</Table.Th>
                  <Table.Th>Detail</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((item) => {
                  const metaString =
                    item.metadata && Object.keys(item.metadata).length > 0
                      ? JSON.stringify(item.metadata, null, 2)
                      : null;
                  const isExpanded = expandedMetaId === item.id;

                  return (
                    <Table.Tr key={item.id}>
                      <Table.Td suppressHydrationWarning>
                        <Text size="xs" fw={500}>
                          {formatDateId(item.createdAt)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="sm"
                          variant="light"
                          color={getActionBadgeColor(item.action)}
                        >
                          {activityActionLabel(item.action)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" fw={600} ff="monospace">
                          {item.ip || "-"}
                        </Text>
                        {item.provider ? (
                          <Text size="xs" c="dimmed">
                            {item.provider}
                          </Text>
                        ) : null}
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{formatDevice(item)}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs">{formatLocation(item)}</Text>
                      </Table.Td>
                      <Table.Td>
                        {metaString ? (
                          <div>
                            <Button
                              variant="subtle"
                              size="compact-xs"
                              onClick={() =>
                                setExpandedMetaId(isExpanded ? null : item.id)
                              }
                            >
                              {isExpanded ? "Tutup" : "Meta"}
                            </Button>
                            <Collapse in={isExpanded}>
                              <Paper p="xs" mt="xs" withBorder>
                                <Code block fz="xs">
                                  {metaString}
                                </Code>
                              </Paper>
                            </Collapse>
                          </div>
                        ) : (
                          <Text size="xs" c="dimmed">
                            -
                          </Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Paper>

          <Group justify="space-between" align="center" mt="xs">
            <Text size="xs" c="dimmed">
              Menampilkan {items.length} dari {total} log
            </Text>
            <Group gap="xs">
              <Button
                size="xs"
                variant="default"
                disabled={offset === 0 || loading}
                onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
              >
                Sebelumnya
              </Button>
              <Button
                size="xs"
                variant="default"
                disabled={offset + items.length >= total || loading}
                onClick={() => setOffset((prev) => prev + limit)}
              >
                Selanjutnya
              </Button>
            </Group>
          </Group>
        </Stack>
      )}
    </ItemCard>
  );
}
