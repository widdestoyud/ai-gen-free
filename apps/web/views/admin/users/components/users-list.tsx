"use client";

import { Button, Group, Text, TextInput } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AppLink } from "@/components/app-link";
import { EmptyState } from "@/components/empty-state";
import { ItemCard } from "@/components/item-card";
import { ADMIN_PAGE_SIZE, adminHref, type AdminUserRow } from "@/lib/admin";
import { formatDateId } from "@/lib/format";

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

  function onSearch(e: FormEvent) {
    e.preventDefault();
    router.push(adminHref("/admin/users", { q: query.trim() }));
  }

  return (
    <div>
      <Text c="dimmed">Saldo dari ledger server. Bukan dump file atau token sesi.</Text>
      <form onSubmit={onSearch}>
        <Group align="flex-end" gap="sm" mt="sm" mb="md">
          <TextInput
            label="Cari email"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
          <Button type="submit">Cari</Button>
        </Group>
      </form>
      {users.length === 0 ? <EmptyState>Tidak ada user.</EmptyState> : null}
      {users.map((user) => (
        <ItemCard key={user.id}>
          <Text>
            <strong>{user.email}</strong> · {user.role}
          </Text>
          <Text>
            Saldo {user.available} poin
            {user.held > 0 ? ` (terkunci ${user.held})` : ""}
          </Text>
          <Text c="dimmed" size="sm">
            Jeda sampai: {user.nextGenerateAt ? formatDateId(user.nextGenerateAt) : "tidak ada"}
          </Text>
          <Text c="dimmed" size="sm">
            Dibuat: {formatDateId(user.createdAt)}
          </Text>
          <AppLink href={`/admin/users/${user.id}`}>Detail / reset / adjust</AppLink>
        </ItemCard>
      ))}
      <Group gap="sm" mt="sm">
        {offset > 0 ? (
          <AppLink href={adminHref("/admin/users", { q, offset: Math.max(0, offset - ADMIN_PAGE_SIZE) })}>
            Sebelumnya
          </AppLink>
        ) : null}
        {users.length >= ADMIN_PAGE_SIZE ? (
          <AppLink href={adminHref("/admin/users", { q, offset: offset + ADMIN_PAGE_SIZE })}>Berikutnya</AppLink>
        ) : null}
      </Group>
    </div>
  );
}