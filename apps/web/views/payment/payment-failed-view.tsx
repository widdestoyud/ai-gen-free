"use client";

import { Badge, Button, Card, Container, Divider, Group, Loader, Paper, Stack, Text, Title } from "@mantine/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/api";
import { formatIdr } from "@/lib/format";

interface InvoiceInfoResponse {
  id: string;
  uniqueCode: string;
  amountIdr: number;
  points: number;
  status: string;
  statusLabel: string;
  createdAt: string;
}

export function PaymentFailedView({ invoiceId }: { invoiceId?: string }) {
  const [loading, setLoading] = useState(Boolean(invoiceId));
  const [invoice, setInvoice] = useState<InvoiceInfoResponse | null>(null);

  // Intercept Android and browser Back button to prevent returning to external payment gateway URL
  useEffect(() => {
    window.history.pushState({ page: "payment_failed" }, "", window.location.href);

    const handlePopState = () => {
      window.location.replace("/app/order");
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!invoiceId) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function checkInvoice() {
      setLoading(true);
      try {
        const infoRes = await requestJson<InvoiceInfoResponse>(`/api/invoices/${invoiceId}/payment-info`);
        if (isMounted && infoRes.ok && infoRes.data) {
          setInvoice(infoRes.data);
        }
      } catch {
        // ignore
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void checkInvoice();

    return () => {
      isMounted = false;
    };
  }, [invoiceId]);

  return (
    <Container size="sm" py={60}>
      <Stack gap="xl" align="center">
        {/* Warning / Error Badge */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            boxShadow: "0 0 32px rgba(239, 68, 68, 0.35)",
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>

        {/* Title and Subtitle */}
        <Stack gap="xs" align="center" style={{ textAlign: "center" }}>
          <Title order={1} fz={{ base: "1.75rem", sm: "2.25rem" }} fw={900}>
            Pembayaran Belum Berhasil
          </Title>
          <Text c="dimmed" size="sm" maw={460}>
            Transaksi pembayaran Anda belum selesai, dibatalkan, atau telah kedaluwarsa. Saldo Anda belum terpotong.
          </Text>
        </Stack>

        {/* Invoice Summary if available */}
        {loading ? (
          <Paper p="xl" withBorder radius="md" style={{ width: "100%", textAlign: "center" }}>
            <Loader size="md" mb="sm" />
            <Text size="sm" c="dimmed">
              Memeriksa data transaksi...
            </Text>
          </Paper>
        ) : invoice ? (
          <Card p="xl" withBorder radius="lg" style={{ width: "100%", background: "var(--mantine-color-dark-8, #14171f)" }}>
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Text size="sm" c="dimmed">
                  Status Tagihan
                </Text>
                <Badge color="red" variant="light" size="lg">
                  {invoice.statusLabel || "Belum Lunas / Batal"}
                </Badge>
              </Group>

              <Divider />

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Nomor Tagihan (Invoice)
                </Text>
                <Text size="sm" fw={600}>
                  {invoice.uniqueCode || invoice.id}
                </Text>
              </Group>

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Paket Sparks
                </Text>
                <Text size="sm" fw={600}>
                  {invoice.points.toLocaleString()} Sparks
                </Text>
              </Group>

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Nominal
                </Text>
                <Text size="sm" fw={700}>
                  {formatIdr(invoice.amountIdr)}
                </Text>
              </Group>
            </Stack>
          </Card>
        ) : null}

        {/* Action Buttons */}
        <Stack gap="sm" style={{ width: "100%" }}>
          <Button
            component={Link}
            href="/app/order"
            variant="gradient"
            gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
            size="md"
            fullWidth
          >
            Coba Pembayaran Ulang
          </Button>

          <Button
            component={Link}
            href="/app/billing"
            variant="default"
            size="md"
            fullWidth
          >
            Kembali ke Halaman Billing
          </Button>
        </Stack>
      </Stack>
    </Container>
  );
}
