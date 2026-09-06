"use client";

import { Button, Group, Text, Textarea, TextInput } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AppLink } from "@/components/app-link";
import { ErrorAlert } from "@/components/error-alert";
import { ItemCard } from "@/components/item-card";
import type { AdminUserRow } from "@/lib/admin";
import { requestJson } from "@/lib/api";
import { formatDateId } from "@/lib/format";

export function AdminUserDetail({ user }: { user: AdminUserRow }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [available, setAvailable] = useState(user.available);
  const [held, setHeld] = useState(user.held);
  const [nextGenerateAt, setNextGenerateAt] = useState(user.nextGenerateAt);
  const [adjustOk, setAdjustOk] = useState(false);

  async function resetCooldown() {
    setBusy(true);
    setError("");
    const result = await requestJson<{ ok: boolean; nextGenerateAt: null }>(
      `/api/admin/users/${user.id}/cooldown/reset`,
      { method: "POST" },
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNextGenerateAt(null);
    setConfirmReset(false);
    router.refresh();
  }

  async function adjust(e: FormEvent) {
    e.preventDefault();
    setError("");
    setAdjustOk(false);
    const parsed = Number(amount);
    if (!Number.isInteger(parsed) || parsed === 0 || Math.abs(parsed) > 1_000_000) {
      setError("Jumlah harus bilangan bulat selain 0 (maks 1000000).");
      return;
    }
    const trimmed = reason.trim();
    if (trimmed.length < 3 || trimmed.length > 500) {
      setError("Alasan wajib diisi (3–500 karakter).");
      return;
    }
    setBusy(true);
    const result = await requestJson<{ available: number; held: number }>(
      `/api/admin/users/${user.id}/wallet/adjust`,
      {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ amount: parsed, reason: trimmed }),
      },
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setAvailable(result.data.available);
    setHeld(result.data.held);
    setAdjustOk(true);
    setAmount("");
    setReason("");
    router.refresh();
  }

  return (
    <div>
      <ErrorAlert message={error} />
      <ItemCard>
        <Text>
          <strong>{user.email}</strong> · {user.role}
        </Text>
        <Text>
          Saldo <strong>{available}</strong> poin
          {held > 0 ? ` (terkunci ${held})` : ""}
        </Text>
        <Text c="dimmed" size="sm">
          Jeda sampai: {nextGenerateAt ? formatDateId(nextGenerateAt) : "tidak ada"}
        </Text>
        {user.emailVerifiedAt ? (
          <Text c="dimmed" size="sm">
            Email terverifikasi: {formatDateId(user.emailVerifiedAt)}
          </Text>
        ) : null}
        <Text c="dimmed" size="sm">
          Dibuat: {formatDateId(user.createdAt)}
        </Text>
        <AppLink href={`/admin/jobs?userId=${encodeURIComponent(user.id)}`}>Lihat job user ini</AppLink>
      </ItemCard>

      <ItemCard>
        <Text fw={600}>Reset jeda generate</Text>
        <Text c="dimmed">
          Mengosongkan jeda user ini saja. User lain tidak terpengaruh. Masih tunduk pada satu job aktif.
        </Text>
        {confirmReset ? (
          <Group gap="sm">
            <Button type="button" color="red" disabled={busy} onClick={() => void resetCooldown()}>
              Ya, reset
            </Button>
            <Button type="button" variant="default" disabled={busy} onClick={() => setConfirmReset(false)}>
              Batal
            </Button>
          </Group>
        ) : (
          <Button type="button" variant="default" disabled={busy} onClick={() => setConfirmReset(true)}>
            Reset jeda
          </Button>
        )}
      </ItemCard>

      <ItemCard>
        <Text fw={600}>Sesuaikan poin</Text>
        <Text c="dimmed">Kredit/debit ledger dengan alasan wajib. Bukan endpoint publik. Jangan kirim peran.</Text>
        <form onSubmit={(e) => void adjust(e)}>
          <TextInput
            label="Jumlah poin"
            description="Positif menambah, negatif mengurangi."
            value={amount}
            onChange={(e) => setAmount(e.currentTarget.value)}
            required
            mt="sm"
          />
          <Textarea
            label="Alasan"
            description="Wajib, 3–500 karakter."
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            required
            minRows={3}
            maxLength={500}
            mt="sm"
          />
          {adjustOk ? (
            <Text c="teal" mt="sm">
              Saldo setelah penyesuaian: {available} poin
              {held > 0 ? ` (terkunci ${held})` : ""}.
            </Text>
          ) : null}
          <Button type="submit" disabled={busy} mt="sm">
            {busy ? "Memproses…" : "Simpan penyesuaian"}
          </Button>
        </form>
      </ItemCard>
    </div>
  );
}