"use client";

import { Button, NumberInput, Text } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ErrorAlert } from "@/components/error-alert";
import { GENERATE_COOLDOWN_DEFAULT, GENERATE_COOLDOWN_MAX } from "@/lib/admin";
import { requestJson } from "@/lib/api";
import { formatDurationId } from "@/lib/format";

export function AdminSettingsForm({ initialValue }: { initialValue: number }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(null);
    if (!Number.isInteger(value) || value < 0 || value > GENERATE_COOLDOWN_MAX) {
      setError("Nilai cooldown harus bilangan bulat 0–2592000.");
      return;
    }
    setBusy(true);
    const result = await requestJson<{ key: string; value: number }>(
      "/api/admin/settings/generate_cooldown_seconds",
      {
        method: "PUT",
        body: JSON.stringify({ value }),
      },
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSaved(result.data.value);
    router.refresh();
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)}>
      <Text>
        Nilai saat ini: <strong>{initialValue}</strong> detik ({formatDurationId(initialValue)}). Default{" "}
        {GENERATE_COOLDOWN_DEFAULT}.
      </Text>
      <Text c="dimmed">
        Nilai baru berlaku untuk generate sukses berikutnya. Jeda yang sudah berjalan tidak diubah. Reset jeda
        user dilakukan terpisah di halaman user. 0 = tanpa jeda pada sukses berikutnya.
      </Text>
      <NumberInput
        label="Jeda generate (detik)"
        min={0}
        max={GENERATE_COOLDOWN_MAX}
        step={60}
        allowDecimal={false}
        clampBehavior="strict"
        value={value}
        onChange={(next) => {
          if (typeof next === "number") setValue(next);
        }}
        mt="sm"
        required
      />
      <ErrorAlert message={error} />
      {saved != null ? (
        <Text c="teal" mt="sm">
          Tersimpan: {saved} detik ({formatDurationId(saved)}).
        </Text>
      ) : null}
      <Button type="submit" disabled={busy} mt="sm">
        {busy ? "Menyimpan…" : "Simpan"}
      </Button>
    </form>
  );
}