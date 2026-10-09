"use client";

import { Button, Card, Group, Radio, Stack, Switch, Text, Title, Badge } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ErrorAlert } from "@/components/error-alert";
import { requestJson } from "@/lib/api";

export interface PaymentSettingsData {
  manualPaymentEnabled: boolean;
  activeOnlineGateway: "midtrans" | "xendit" | "doku" | "dana" | "none";
  manualExpiryMinutes: number;
  onlineExpiryMinutes: number;
  availableGateways?: string[];
}

export function AdminPaymentSettingsForm({
  initialSettings,
}: {
  initialSettings: PaymentSettingsData;
}) {
  const router = useRouter();
  const [manualEnabled, setManualEnabled] = useState(initialSettings.manualPaymentEnabled);
  const [onlineGateway, setOnlineGateway] = useState<"midtrans" | "xendit" | "doku" | "dana" | "none">(
    initialSettings.activeOnlineGateway,
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);

    if (!manualEnabled && onlineGateway === "none") {
      setError("Minimal satu metode pembayaran (Transfer Manual atau Online Gateway) harus aktif.");
      return;
    }

    setBusy(true);
    const result = await requestJson<PaymentSettingsData>("/api/admin/settings/payment", {
      method: "PUT",
      body: JSON.stringify({
        manualPaymentEnabled: manualEnabled,
        activeOnlineGateway: onlineGateway,
      }),
    });
    setBusy(false);

    if (!result.ok) {
      setError(result.message || "Gagal menyimpan pengaturan pembayaran");
      return;
    }
    if (!result.data) {
      setError("Gagal menyimpan pengaturan pembayaran");
      return;
    }

    setManualEnabled(result.data.manualPaymentEnabled);
    setOnlineGateway(result.data.activeOnlineGateway);
    setSaved(true);
    router.refresh();
  }

  return (
    <Card withBorder radius="md" p="lg" mt="xl">
      <Title order={3} size="h4" mb="xs">
        Pengaturan Metode Pembayaran
      </Title>
      <Text size="sm" c="dimmed" mb="lg">
        Konfigurasikan ketersediaan transfer manual dan payment gateway pihak ke-3 (Midtrans / Xendit).
      </Text>

      <form onSubmit={(e) => void onSubmit(e)}>
        <Stack gap="lg">
          {/* Section 1: Transfer Manual */}
          <Card withBorder p="md" radius="sm">
            <Group justify="space-between" align="flex-start" wrap="nowrap">
              <div>
                <Group gap="xs" mb={4}>
                  <Text fw={600} size="sm">
                    Transfer Manual (QRIS / Bank)
                  </Text>
                  <Badge color="blue" variant="light" size="xs">
                    Masa Berlaku: 1 Jam (60 Menit)
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  Pelanggan membayar secara manual dan mengunggah foto / tangkapan layar bukti transfer untuk dikurasi admin.
                </Text>
              </div>
              <Switch
                checked={manualEnabled}
                onChange={(e) => setManualEnabled(e.currentTarget.checked)}
                size="md"
                aria-label="Aktifkan Transfer Manual"
              />
            </Group>
          </Card>

          {/* Section 2: 3rd Party Online Payment Gateway */}
          <Card withBorder p="md" radius="sm">
            <Stack gap="sm">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Group gap="xs" mb={4}>
                    <Text fw={600} size="sm">
                      Online Payment Gateway (Pihak Ke-3)
                    </Text>
                    <Badge color="teal" variant="light" size="xs">
                      Masa Berlaku Sesi: 10 Menit
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Pilih 1 penyedia payment gateway online otomatis yang aktif. Hanya 1 gateway yang dapat dipilih dalam satu waktu.
                  </Text>
                </div>
              </Group>

              <Radio.Group
                value={onlineGateway}
                onChange={(val) => setOnlineGateway(val as "midtrans" | "xendit" | "doku" | "dana" | "none")}
              >
                <Stack gap="xs" mt="xs">
                  <Radio
                    value="doku"
                    label={
                      <div>
                        <Text size="sm" fw={500}>
                          DOKU (Direct API & DOKU Checkout)
                        </Text>
                        <Text size="xs" c="dimmed">
                          Mendukung Virtual Account (BCA, Mandiri, BRI, BNI, Permata, CIMB, Danamon, BSI, BTN), QRIS, E-Wallet (DANA, OVO, ShopeePay), Kartu Kredit, Paylater, dan Gerai Retail (Alfamart/Indomaret).
                        </Text>
                      </div>
                    }
                  />
                  <Radio
                    value="xendit"
                    label={
                      <div>
                        <Text size="sm" fw={500}>
                          Xendit
                        </Text>
                        <Text size="xs" c="dimmed">
                          Mendukung QRIS instan, E-Wallet (OVO, DANA, ShopeePay, LinkAja), dan Virtual Account transfer bank.
                        </Text>
                      </div>
                    }
                  />
                  <Radio
                    value="midtrans"
                    label={
                      <div>
                        <Text size="sm" fw={500}>
                          Midtrans Snap
                        </Text>
                        <Text size="xs" c="dimmed">
                          Mendukung Midtrans Snap Popup, Virtual Account (BCA, Mandiri, BNI, BRI, Permata), QRIS, GoPay, ShopeePay.
                        </Text>
                      </div>
                    }
                  />
                  <Radio
                    value="dana"
                    label={
                      <div>
                        <Text size="sm" fw={500}>
                          DANA Payment Gateway (SNAP)
                        </Text>
                        <Text size="xs" c="dimmed">
                          Mendukung pembayaran langsung via DANA E-Wallet & QRIS.
                        </Text>
                      </div>
                    }
                  />
                  <Radio
                    value="none"
                    label={
                      <div>
                        <Text size="sm" fw={500}>
                          Nonaktifkan Gateway Online
                        </Text>
                        <Text size="xs" c="dimmed">
                          Hanya menggunakan metode Transfer Manual.
                        </Text>
                      </div>
                    }
                  />
                </Stack>
              </Radio.Group>
            </Stack>
          </Card>

          <ErrorAlert message={error} />

          {saved && (
            <Text c="teal" size="sm" fw={500}>
              ✓ Pengaturan metode pembayaran berhasil disimpan.
            </Text>
          )}

          <Group justify="flex-start">
            <Button type="submit" loading={busy} disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan Pengaturan Pembayaran"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
}
