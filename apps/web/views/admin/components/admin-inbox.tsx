"use client";

import { Button, Group, Image, Text, TextInput } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { ItemCard } from "@/components/item-card";
import { requestJson } from "@/lib/api";
import { formatDateId, formatIdr } from "@/lib/format";
import type { InboxItem } from "@/app/admin/page";

export function AdminInbox({ items }: { items: InboxItem[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function loadProof(id: string) {
    setError("");
    const result = await requestJson<{ url?: string; contentType?: string }>(`/api/admin/invoices/${id}/proof`);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPreviewType(result.data.contentType ?? null);
    setPreview(`/api/admin/invoices/${id}/file`);
  }

  async function approve(id: string) {
    setBusy(true);
    setError("");
    const result = await requestJson(`/api/admin/invoices/${id}/approve`, {
      method: "POST",
      body: "{}",
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPreview(null);
    setPreviewType(null);
    router.refresh();
  }

  async function reject(id: string) {
    setBusy(true);
    setError("");
    const result = await requestJson(`/api/admin/invoices/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason: reason[id] ?? "" }),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPreview(null);
    setPreviewType(null);
    router.refresh();
  }

  if (items.length === 0) {
    return <EmptyState>Tidak ada bukti menunggu kurasi.</EmptyState>;
  }

  return (
    <div>
      <ErrorAlert message={error} />
      {preview ? (
        <ItemCard>
          <Text>
            <AppLink href={preview} external>
              Buka bukti di tab baru
            </AppLink>
          </Text>
          {previewType?.startsWith("image/") ? (
            <Image src={preview} alt="Bukti transfer" radius="md" />
          ) : null}
        </ItemCard>
      ) : null}
      {items.map((item) => (
        <ItemCard key={item.invoiceId}>
          <Text>
            <strong>{item.uniqueCode}</strong> · {item.email}
          </Text>
          <Text>
            {formatIdr(item.amountIdr)} · {item.points} poin
          </Text>
          <Text c="dimmed" size="sm">
            {item.proofSubmittedAt ? formatDateId(item.proofSubmittedAt) : ""}
          </Text>
          <Group gap="sm">
            <Button type="button" disabled={busy} onClick={() => void loadProof(item.invoiceId)}>
              Lihat bukti
            </Button>
            <Button type="button" disabled={busy} onClick={() => void approve(item.invoiceId)}>
              Terima
            </Button>
          </Group>
          <TextInput
            label="Alasan tolak"
            value={reason[item.invoiceId] ?? ""}
            onChange={(e) => setReason((s) => ({ ...s, [item.invoiceId]: e.currentTarget.value }))}
          />
          <Button
            type="button"
            color="red"
            disabled={busy}
            onClick={() => void reject(item.invoiceId)}
          >
            Tolak
          </Button>
        </ItemCard>
      ))}
    </div>
  );
}
