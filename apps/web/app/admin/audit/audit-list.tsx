"use client";

import { Button, Group, Select, Text } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AppLink } from "@/components/app-link";
import { EmptyState } from "@/components/empty-state";
import { ItemCard } from "@/components/item-card";
import {
  ADMIN_PAGE_SIZE,
  adminHref,
  auditActionLabel,
  type AdminAuditItem,
} from "@/lib/admin";
import { formatDateId } from "@/lib/format";

const ACTIONS = [
  { value: "all", label: "Semua aksi" },
  { value: "settings.generate_cooldown_seconds.updated", label: "Ubah jeda generate" },
  { value: "user.cooldown.reset", label: "Reset jeda generate" },
  { value: "wallet.adjusted", label: "Penyesuaian poin" },
  { value: "invoice.approved", label: "Invoice disetujui" },
  { value: "invoice.rejected", label: "Invoice ditolak" },
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
  action,
  offset,
}: {
  items: AdminAuditItem[];
  action: string;
  offset: number;
}) {
  const router = useRouter();
  const [actionValue, setActionValue] = useState(action || "all");

  function onSearch(e: FormEvent) {
    e.preventDefault();
    router.push(adminHref("/admin/audit", { action: actionValue === "all" ? "" : actionValue }));
  }

  return (
    <div>
      <Text c="dimmed">Catatan aksi admin. Tanpa foto atau prompt kesusilaan mentah.</Text>
      <form onSubmit={onSearch}>
        <Group align="flex-end" gap="sm" mt="sm" mb="md">
          <Select
            label="Aksi"
            data={ACTIONS}
            value={actionValue}
            onChange={(value) => setActionValue(value ?? "all")}
          />
          <Button type="submit">Filter</Button>
        </Group>
      </form>
      {items.length === 0 ? <EmptyState>Belum ada jejak audit.</EmptyState> : null}
      {items.map((item) => {
        const meta = metaText(item.meta);
        return (
          <ItemCard key={item.id}>
            <Text>
              <strong>{auditActionLabel(item.action)}</strong>
            </Text>
            <Text size="sm">{item.actorEmail ?? item.actorId}</Text>
            {item.target ? (
              <Text c="dimmed" size="sm">
                Target: {item.target}
              </Text>
            ) : null}
            {meta ? (
              <Text c="dimmed" size="sm">
                {meta}
              </Text>
            ) : null}
            <Text c="dimmed" size="sm">
              {formatDateId(item.createdAt)}
            </Text>
          </ItemCard>
        );
      })}
      <Group gap="sm" mt="sm">
        {offset > 0 ? (
          <AppLink
            href={adminHref("/admin/audit", { action, offset: Math.max(0, offset - ADMIN_PAGE_SIZE) })}
          >
            Sebelumnya
          </AppLink>
        ) : null}
        {items.length >= ADMIN_PAGE_SIZE ? (
          <AppLink href={adminHref("/admin/audit", { action, offset: offset + ADMIN_PAGE_SIZE })}>
            Berikutnya
          </AppLink>
        ) : null}
      </Group>
    </div>
  );
}