"use client";

import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  Divider,
  Group,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ErrorAlert } from "@/components/error-alert";
import { requestJson } from "@/lib/api";

export interface TesterAccountSettingsData {
  enabled: boolean;
  email: string;
  otp: string;
  expiresAt: string;
}

export function AdminTesterAccountForm({
  initialSettings,
}: {
  initialSettings: TesterAccountSettingsData;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialSettings.enabled);
  const [email, setEmail] = useState(initialSettings.email);
  const [otp, setOtp] = useState(initialSettings.otp);
  
  // Format to YYYY-MM-DD for standard date input
  const initialDateStr = initialSettings.expiresAt
    ? new Date(initialSettings.expiresAt).toISOString().split("T")[0]
    : "2026-10-20";
  const [expiresDate, setExpiresDate] = useState(initialDateStr);

  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const isExpired = new Date(expiresDate + "T23:59:59.999Z").getTime() < Date.now();
  const isActive = enabled && !isExpired;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);

    if (!email.trim() || !email.includes("@")) {
      setError("Email akun reviewer wajib diisi dengan format valid.");
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Kode OTP harus berupa 6 digit angka.");
      return;
    }

    if (!expiresDate) {
      setError("Tanggal batas masa aktif akun wajib diisi.");
      return;
    }

    const isoExpiresAt = new Date(expiresDate + "T23:59:59.999Z").toISOString();

    setBusy(true);
    const result = await requestJson<TesterAccountSettingsData>(
      "/api/admin/settings/tester-account",
      {
        method: "PUT",
        body: JSON.stringify({
          enabled,
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
          expiresAt: isoExpiresAt,
        }),
      },
    );
    setBusy(false);

    if (!result.ok) {
      setError(result.message || "Gagal menyimpan konfigurasi akun testing");
      return;
    }
    if (!result.data) {
      setError("Gagal menyimpan konfigurasi akun testing");
      return;
    }

    setEnabled(result.data.enabled);
    setEmail(result.data.email);
    setOtp(result.data.otp);
    setExpiresDate(new Date(result.data.expiresAt).toISOString().split("T")[0]);
    setSaved(true);
    router.refresh();
  }

  function handleCopyCredentials() {
    const text = `URL Login: https://satulabs.id/\nEmail Reviewer: ${email}\nKode OTP: ${otp}\n(Masukkan sembarang kata sandi, lalu masukkan kode OTP di atas)`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card withBorder radius="md" p="lg" mt="xl">
      <Group justify="space-between" align="center" mb="xs">
        <Title order={3} size="h4">
          Akun Testing & Reviewer Payment Gateway
        </Title>
        <Badge
          color={isActive ? "green" : isExpired ? "red" : "gray"}
          variant="light"
          size="sm"
        >
          {isActive ? "Aktif" : isExpired ? "Kedaluwarsa" : "Non-aktif"}
        </Badge>
      </Group>

      <Text size="sm" c="dimmed" mb="lg">
        Konfigurasikan akun khusus pengujian untuk tim reviewer Payment Gateway (Midtrans, Xendit, DOKU, DANA) agar dapat memverifikasi alur pembelian tanpa kendala OTP riil.
      </Text>

      <form onSubmit={(e) => void onSubmit(e)}>
        <Stack gap="md">
          <Card withBorder p="md" radius="sm">
            <Group justify="space-between" align="center">
              <div>
                <Text fw={600} size="sm">
                  Aktifkan Mode Akun Testing
                </Text>
                <Text size="xs" c="dimmed">
                  Saat aktif dan belum kedaluwarsa, email ini dapat login menggunakan OTP tetap di bawah tanpa pengiriman email riil.
                </Text>
              </div>
              <Switch
                checked={enabled}
                onChange={(e) => setEnabled(e.currentTarget.checked)}
                size="md"
                aria-label="Aktifkan Akun Testing"
              />
            </Group>
          </Card>

          <Group grow align="flex-start">
            <TextInput
              label="Email Akun Reviewer"
              description="Email yang didaftarkan khusus untuk tim reviewer PG"
              placeholder="reviewer-pg@satulabs.id"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              required
              disabled={busy}
            />

            <TextInput
              label="Kode OTP Tetap (Fixed OTP)"
              description="6 digit angka yang digunakan reviewer untuk verifikasi"
              placeholder="201026"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
              required
              disabled={busy}
            />

            <TextInput
              type="date"
              label="Masa Aktif (Sampai Dengan)"
              description="Batas akhir waktu akun tester dapat digunakan"
              value={expiresDate}
              onChange={(e) => setExpiresDate(e.currentTarget.value)}
              required
              disabled={busy}
            />
          </Group>

          {/* Helper Box: Format siap salin untuk tim KYC Payment Gateway */}
          <Card withBorder p="sm" radius="sm" style={{ background: "rgba(0, 0, 0, 0.2)" }}>
            <Group justify="space-between" align="center" mb={6}>
              <Text size="xs" fw={700} c="dimmed">
                INFORMASI KREDENSIAL UNTUK TIM REVIEWER PAYMENT GATEWAY
              </Text>
              <Button
                size="compact-xs"
                variant="light"
                color={copied ? "teal" : "blue"}
                onClick={handleCopyCredentials}
              >
                {copied ? "Tersalin!" : "Salin Kredensial"}
              </Button>
            </Group>
            <Divider mb="xs" />
            <Stack gap={4}>
              <Text size="xs">
                <strong>URL Website:</strong> <Code>https://satulabs.id/</Code>
              </Text>
              <Text size="xs">
                <strong>Email Akun:</strong> <Code>{email}</Code>
              </Text>
              <Text size="xs">
                <strong>Kode OTP:</strong> <Code>{otp}</Code>
              </Text>
              <Text size="xs" c="dimmed">
                <em>Catatan: Reviewer dapat memasukkan kata sandi apa saja saat login, lalu memasukkan kode OTP di atas.</em>
              </Text>
            </Stack>
          </Card>

          {error && <ErrorAlert message={error} />}

          {saved && (
            <Alert color="teal" variant="light" p="xs">
              <Text size="xs">Konfigurasi akun testing berhasil disimpan.</Text>
            </Alert>
          )}

          <Group justify="flex-end">
            <Button
              type="submit"
              loading={busy}
              disabled={busy}
              variant="filled"
              color="blue"
            >
              Simpan Pengaturan Akun Tester
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
}
