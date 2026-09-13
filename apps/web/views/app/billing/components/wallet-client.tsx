"use client";

import { Button, FileInput, Group, List, Text, Title } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { ItemCard } from "@/components/item-card";
import { requestJson } from "@/lib/api";
import { formatDateId, formatIdr } from "@/lib/format";
import type { Invoice, LedgerRow, Package } from "../types";

export function WalletClient(props: {
  available: number;
  held: number;
  packages: Package[];
  invoices: Invoice[];
  entries: LedgerRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function buy(packageId: string) {
    setError("");
    setBusy(true);
    const result = await requestJson("/api/invoices", {
      method: "POST",
      body: JSON.stringify({ packageId }),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  async function upload(invoiceId: string, file: File) {
    setError("");
    setBusy(true);
    const form = new FormData();
    form.set("file", file);
    const result = await requestJson(`/api/invoices/${invoiceId}/proof`, {
      method: "POST",
      body: form,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <Text size="lg">
        Saldo <strong>{props.available}</strong> poin
        {props.held > 0 ? ` (terkunci ${props.held})` : ""}
      </Text>
      <Title order={2} mt="md">
        Isi saldo
      </Title>
      <Text c="dimmed">
        Bayar QRIS sesuai invoice, lalu unggah bukti di sini. Poin masuk setelah admin menyetujui.
        Jangan kirim screenshot lewat WhatsApp atau Telegram.
      </Text>
      <Group gap="sm" mt="sm" mb="md">
        {props.packages.map((p) => (
          <Button key={p.id} type="button" disabled={busy} onClick={() => buy(p.id)}>
            {p.label}
          </Button>
        ))}
      </Group>
      <ErrorAlert message={error} />

      <Title order={2} mt="lg">
        Invoice
      </Title>
      {props.invoices.length === 0 ? <EmptyState>Belum ada invoice.</EmptyState> : null}
      {props.invoices.map((inv) => (
        <ItemCard key={inv.id}>
          <Text>
            <strong>{inv.uniqueCode}</strong> · {formatIdr(inv.amountIdr)} · {inv.points} poin
          </Text>
          <Text>{inv.statusLabel}</Text>
          {inv.instructions && inv.status === "unpaid" ? (
            <Text c="dimmed" size="sm">
              {inv.instructions}
            </Text>
          ) : null}
          {inv.reviewNote && inv.status === "rejected" ? (
            <Text c="red">Alasan: {inv.reviewNote}</Text>
          ) : null}
          {(inv.status === "unpaid" || inv.status === "rejected") && (
            <FileInput
              label="Unggah bukti"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={busy}
              onChange={(file) => {
                if (file) void upload(inv.id, file);
              }}
            />
          )}
        </ItemCard>
      ))}

      <Title order={2} mt="lg">
        Riwayat
      </Title>
      {props.entries.length === 0 ? <EmptyState>Belum ada transaksi poin.</EmptyState> : null}
      <List>
        {props.entries.map((e) => (
          <List.Item key={e.id}>
            {e.label} · {e.amount} · {formatDateId(e.createdAt)}
          </List.Item>
        ))}
      </List>
    </div>
  );
}
