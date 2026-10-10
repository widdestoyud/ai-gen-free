"use client";

import { Badge, Button, Card, Container, Divider, Group, Loader, Paper, Stack, Text, Title } from "@mantine/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/api";
import { formatDateId, formatIdr } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

interface InvoiceInfoResponse {
  id: string;
  uniqueCode: string;
  amountIdr: number;
  points: number;
  status: string;
  statusLabel: string;
  createdAt: string;
  gatewayExpiredAt?: string | null;
}

export function PaymentExpiredView({ invoiceId }: { invoiceId?: string }) {
  const { t } = useI18n("payment");
  const [loading, setLoading] = useState(Boolean(invoiceId));
  const [invoice, setInvoice] = useState<InvoiceInfoResponse | null>(null);

  // Intercept Android and browser Back button to prevent returning to external payment gateway URL
  useEffect(() => {
    window.history.pushState({ page: "payment_expired" }, "", window.location.href);

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
        {/* Expired Clock Icon Badge */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            boxShadow: "0 0 32px rgba(245, 158, 11, 0.35)",
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        {/* Title and Subtitle */}
        <Stack gap="xs" align="center" style={{ textAlign: "center" }}>
          <Title order={1} fz={{ base: "1.75rem", sm: "2.25rem" }} fw={900}>
            {t("expired.title")}
          </Title>
          <Text c="dimmed" size="sm" maw={460}>
            {t("expired.subtitle")}
          </Text>
        </Stack>

        {/* Loading Spinner or Invoice Summary */}
        {loading ? (
          <Paper p="xl" withBorder radius="md" style={{ width: "100%", textAlign: "center" }}>
            <Loader size="md" mb="sm" />
            <Text size="sm" c="dimmed">
              {t("expired.checking")}
            </Text>
          </Paper>
        ) : invoice ? (
          <Card p="xl" withBorder radius="lg" style={{ width: "100%", background: "var(--mantine-color-dark-8, #14171f)" }}>
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Text size="sm" c="dimmed">
                  {t("expired.status_label")}
                </Text>
                <Badge color="yellow" variant="light" size="lg">
                  {t("expired.status_expired")}
                </Badge>
              </Group>

              <Divider />

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {t("expired.invoice_number")}
                </Text>
                <Text size="sm" fw={600}>
                  {invoice.uniqueCode || invoice.id}
                </Text>
              </Group>

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {t("expired.package_label")}
                </Text>
                <Text size="sm" fw={600}>
                  {t("expired.sparks_amount", { points: invoice.points.toLocaleString() })}
                </Text>
              </Group>

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {t("expired.total_amount")}
                </Text>
                <Text size="sm" fw={700}>
                  {formatIdr(invoice.amountIdr)}
                </Text>
              </Group>

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {t("expired.created_at")}
                </Text>
                <Text size="sm" c="gray.4" suppressHydrationWarning>
                  {formatDateId(invoice.createdAt)}
                </Text>
              </Group>
            </Stack>
          </Card>
        ) : null}

        {/* Action Buttons */}
        <Group gap="md" style={{ width: "100%" }} justify="center">
          <Button
            component={Link}
            href="/app/order"
            size="md"
            variant="filled"
            color="blue"
            radius="md"
            style={{ flex: 1, maxWidth: 220 }}
          >
            {t("expired.btn_reorder")}
          </Button>
          <Button
            component={Link}
            href="/app/generate"
            size="md"
            variant="default"
            radius="md"
            style={{ flex: 1, maxWidth: 220 }}
          >
            {t("expired.btn_studio")}
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
