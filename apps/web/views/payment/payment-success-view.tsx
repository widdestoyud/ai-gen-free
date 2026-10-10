"use client";

import { Badge, Button, Card, Container, Divider, Group, Loader, Paper, Stack, Text, Title } from "@mantine/core";
import Link from "next/link";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/api";
import { formatDateId, formatIdr } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

interface PaymentStatusResponse {
  invoiceId: string;
  status: string;
  paidAt?: string;
  paymentChannel?: string;
  message?: string;
}

interface InvoiceInfoResponse {
  id: string;
  uniqueCode: string;
  amountIdr: number;
  points: number;
  status: string;
  statusLabel: string;
  createdAt: string;
  paidAt?: string;
  gateway?: {
    paymentChannel?: string;
    paymentMethod?: string;
  };
}

export function PaymentSuccessView({ invoiceId }: { invoiceId?: string }) {
  const { t } = useI18n("payment");
  const [loading, setLoading] = useState(Boolean(invoiceId));
  const [invoice, setInvoice] = useState<InvoiceInfoResponse | null>(null);
  const [statusInfo, setStatusInfo] = useState<PaymentStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Intercept Android and browser Back button to prevent returning to external payment gateway URL
  useEffect(() => {
    window.history.pushState({ page: "payment_success" }, "", window.location.href);

    const handlePopState = () => {
      window.location.replace("/app/generate");
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

    async function verifyPayment() {
      setLoading(true);
      setError(null);

      try {
        // 1. Trigger payment status check (this ensures database is credited if Gateway says paid)
        const statusRes = await requestJson<PaymentStatusResponse>(`/api/invoices/${invoiceId}/payment-status`);
        if (isMounted && statusRes.ok && statusRes.data) {
          setStatusInfo(statusRes.data);
          const rawStatus = (statusRes.data.status || "").toLowerCase();
          if (rawStatus === "expired") {
            window.location.replace(`/payment/expired?invoice=${encodeURIComponent(invoiceId || "")}`);
            return;
          }
          if (rawStatus === "failed" || rawStatus === "rejected" || rawStatus === "cancelled") {
            window.location.replace(`/payment/failed?invoice=${encodeURIComponent(invoiceId || "")}`);
            return;
          }
        }

        // 2. Fetch invoice info for display
        const infoRes = await requestJson<InvoiceInfoResponse>(`/api/invoices/${invoiceId}/payment-info`);
        if (isMounted && infoRes.ok && infoRes.data) {
          if (infoRes.data.status === "expired") {
            window.location.replace(`/payment/expired?invoice=${encodeURIComponent(invoiceId || "")}`);
            return;
          }
          if (infoRes.data.status === "rejected" || infoRes.data.status === "cancelled") {
            window.location.replace(`/payment/failed?invoice=${encodeURIComponent(invoiceId || "")}`);
            return;
          }
          setInvoice(infoRes.data);
        }
      } catch {
        if (isMounted) {
          setError(t("success.error_load"));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void verifyPayment();

    return () => {
      isMounted = false;
    };
  }, [invoiceId, t]);

  return (
    <Container size="sm" py={60}>
      <Stack gap="xl" align="center">
        {/* Animated Checkmark Badge */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            boxShadow: "0 0 32px rgba(16, 185, 129, 0.35)",
          }}
        >
          <svg
            width="42"
            height="42"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* Title and Subtitle */}
        <Stack gap="xs" align="center" style={{ textAlign: "center" }}>
          <Title order={1} fz={{ base: "1.75rem", sm: "2.25rem" }} fw={900}>
            {t("success.title")}
          </Title>
          <Text c="dimmed" size="sm" maw={460}>
            {t("success.subtitle")}
          </Text>
        </Stack>

        {/* Loading Spinner or Invoice Summary */}
        {loading ? (
          <Paper p="xl" withBorder radius="md" style={{ width: "100%", textAlign: "center" }}>
            <Loader size="md" mb="sm" />
            <Text size="sm" c="dimmed">
              {t("success.verifying")}
            </Text>
          </Paper>
        ) : invoice ? (
          <Card p="xl" withBorder radius="lg" style={{ width: "100%", background: "var(--mantine-color-dark-8, #14171f)" }}>
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <Text size="sm" c="dimmed">
                  {t("success.status_label")}
                </Text>
                <Badge color="green" variant="light" size="lg">
                  {t("success.status_paid")}
                </Badge>
              </Group>

              <Divider />

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {t("success.invoice_number")}
                </Text>
                <Text size="sm" fw={600}>
                  {invoice.uniqueCode || invoice.id}
                </Text>
              </Group>

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {t("success.sparks_added")}
                </Text>
                <Text size="sm" fw={700} c="green.4">
                  {t("success.sparks_amount", { points: invoice.points.toLocaleString() })}
                </Text>
              </Group>

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {t("success.total_paid")}
                </Text>
                <Text size="sm" fw={700}>
                  {formatIdr(invoice.amountIdr)}
                </Text>
              </Group>

              {invoice.gateway?.paymentChannel || statusInfo?.paymentChannel ? (
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    {t("success.payment_method")}
                  </Text>
                  <Text size="sm" fw={500}>
                    {invoice.gateway?.paymentChannel || statusInfo?.paymentChannel}
                  </Text>
                </Group>
              ) : null}

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  {t("success.transaction_time")}
                </Text>
                <Text size="sm" c="gray.3" suppressHydrationWarning>
                  {invoice.paidAt ? formatDateId(invoice.paidAt) : formatDateId(new Date().toISOString())}
                </Text>
              </Group>
            </Stack>
          </Card>
        ) : error ? (
          <Paper p="md" withBorder radius="md" style={{ width: "100%" }} bg="rgba(239, 68, 68, 0.1)">
            <Text size="sm" c="red.4" ta="center">
              {error}
            </Text>
          </Paper>
        ) : null}

        {/* Highlight Note */}
        <Paper p="md" withBorder radius="md" bg="rgba(59, 130, 246, 0.08)" style={{ width: "100%", borderColor: "rgba(59, 130, 246, 0.2)" }}>
          <Group gap="xs" wrap="nowrap" align="flex-start">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <Text size="xs" c="gray.3" lh={1.5}>
              {t("success.sparks_ready_note")}
            </Text>
          </Group>
        </Paper>

        {/* Action Buttons */}
        <Stack gap="sm" style={{ width: "100%" }}>
          <Button
            component={Link}
            href="/app/generate"
            variant="gradient"
            gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
            size="md"
            fullWidth
          >
            {t("success.btn_start_create")}
          </Button>

          <Button
            component={Link}
            href="/app/billing"
            variant="default"
            size="md"
            fullWidth
          >
            {t("success.btn_view_billing")}
          </Button>
        </Stack>
      </Stack>
    </Container>
  );
}
