"use client";

import { Button, FileInput, Group, Text, Title, Badge, Stack, Divider, Loader } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { SnapPaymentModal } from "@/components/snap-payment-modal";
import { ItemCard } from "@/components/item-card";
import { requestJson } from "@/lib/api";
import { formatDateId, formatIdr } from "@/lib/format";
import { usePayment } from "@/hooks/use-payment";
import type { Invoice, LedgerRow, Package } from "../types";

import { CreditHistory } from "./credit-history";

function InvoiceCard({
  inv,
  busy,
  onUpload,
  onPayGateway,
  onCancel,
  gatewayEnabled,
  payingInvoiceId,
}: {
  inv: Invoice;
  busy: boolean;
  onUpload: (invoiceId: string, file: File) => void;
  onPayGateway: (invoiceId: string, invoiceCode: string) => void;
  onCancel?: (invoiceId: string) => void;
  gatewayEnabled: boolean;
  payingInvoiceId: string | null;
}) {
  const isPaying = payingInvoiceId === inv.id;
  const canPay = inv.status === "unpaid" || inv.status === "rejected";
  const hasGatewaySession = inv.gateway?.paymentUrl && inv.gateway?.expiredAt;
  const gatewayExpired = hasGatewaySession && new Date(inv.gateway!.expiredAt!) < new Date();

  return (
    <ItemCard key={inv.id}>
      <Group justify="space-between" mb="xs">
        <Text fw={600}>{inv.uniqueCode}</Text>
        <Badge
          color={
            inv.status === "paid"
              ? "green"
              : inv.status === "awaiting_review"
                ? "yellow"
                : inv.status === "rejected"
                  ? "red"
                  : "gray"
          }
        >
          {inv.statusLabel}
        </Badge>
      </Group>

      <Text size="sm" c="dimmed">
        {formatIdr(inv.amountIdr)} · {inv.points} poin
      </Text>

      {inv.instructions && inv.status === "unpaid" ? (
        <Text c="dimmed" size="sm" mt="xs">
          {inv.instructions}
        </Text>
      ) : null}

      {inv.reviewNote && inv.status === "rejected" ? (
        <Text c="red" size="sm" mt="xs">
          Alasan: {inv.reviewNote}
        </Text>
      ) : null}

      {inv.paidAt && inv.status === "paid" ? (
        <Text c="green" size="sm" mt="xs" suppressHydrationWarning>
          Dibayar: {formatDateId(inv.paidAt)}
          {inv.gateway?.paymentChannel ? ` via ${inv.gateway.paymentChannel}` : ""}
        </Text>
      ) : null}

      {canPay && (
        <Stack gap="sm" mt="md">
          {/* Online Payment Option */}
          {gatewayEnabled && (
            <>
              <Button
                variant="filled"
                color="blue"
                disabled={busy || isPaying}
                leftSection={isPaying ? <Loader size="xs" /> : null}
                onClick={() => onPayGateway(inv.id, inv.uniqueCode)}
              >
                {isPaying
                  ? "Memproses..."
                  : hasGatewaySession && !gatewayExpired
                    ? "Lanjutkan Pembayaran Online"
                    : "Bayar Online (Midtrans Snap)"}
              </Button>
              <Divider label="atau" labelPosition="center" />
            </>
          )}

          {/* Manual Upload Option */}
          <FileInput
            label="Unggah bukti transfer manual"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={busy}
            onChange={(file) => {
              if (file) onUpload(inv.id, file);
            }}
          />

          {onCancel && (
            <Group justify="flex-end" mt="xs">
              <Button
                variant="subtle"
                color="red"
                size="xs"
                disabled={busy || isPaying}
                onClick={() => {
                  if (window.confirm("Apakah Anda yakin ingin membatalkan pesanan ini?")) {
                    onCancel(inv.id);
                  }
                }}
              >
                Batalkan Pesanan
              </Button>
            </Group>
          )}
        </Stack>
      )}
    </ItemCard>
  );
}

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
  const [gatewayEnabled, setGatewayEnabled] = useState(true);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

  // Snap Payment Modal state
  const [snapInvoice, setSnapInvoice] = useState<{ id: string; code: string } | null>(null);

  const {
    error: paymentError,
    clearError: clearPaymentError,
  } = usePayment();

  async function buy(packageId: string) {
    setError("");
    clearPaymentError();
    setBusy(true);
    const result = await requestJson<{ id: string; uniqueCode: string }>("/api/invoices", {
      method: "POST",
      body: JSON.stringify({ packageId }),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    // Jika online gateway aktif, langsung buka modal pembayaran Snap
    if (gatewayEnabled && result.data?.id && result.data?.uniqueCode) {
      setSnapInvoice({ id: result.data.id, code: result.data.uniqueCode });
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

  async function cancel(invoiceId: string) {
    setError("");
    setBusy(true);
    const result = await requestJson(`/api/invoices/${invoiceId}/cancel`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  const handlePayGateway = useCallback((invoiceId: string, invoiceCode: string) => {
    setError("");
    clearPaymentError();
    setSnapInvoice({ id: invoiceId, code: invoiceCode });
  }, [clearPaymentError]);

  const displayError = error || paymentError;

  return (
    <div>
      <Text size="lg">
        Saldo <strong>{props.available}</strong> poin
        {props.held > 0 ? ` (terkunci ${props.held})` : ""}
      </Text>

      <Title order={2} mt="md">
        Isi saldo
      </Title>

      {gatewayEnabled ? (
        <Text c="dimmed">
          Pilih paket, lalu bayar instan via Midtrans (Virtual Account, QRIS, GoPay, ShopeePay).
          Poin otomatis masuk setelah pembayaran berhasil.
        </Text>
      ) : (
        <Text c="dimmed">
          Bayar sesuai invoice, lalu unggah bukti transfer di sini. Poin masuk setelah admin menyetujui.
        </Text>
      )}

      <Group gap="sm" mt="sm" mb="md">
        {props.packages.map((p) => (
          <Button key={p.id} type="button" disabled={busy} onClick={() => buy(p.id)}>
            {p.label}
          </Button>
        ))}
      </Group>

      <ErrorAlert message={displayError} />

      <Title order={2} mt="lg">
        Invoice
      </Title>

      {props.invoices.length === 0 ? (
        <EmptyState>Belum ada invoice.</EmptyState>
      ) : null}

      {props.invoices.map((inv) => (
        <InvoiceCard
          key={inv.id}
          inv={inv}
          busy={busy}
          onUpload={upload}
          onPayGateway={handlePayGateway}
          onCancel={cancel}
          gatewayEnabled={gatewayEnabled}
          payingInvoiceId={payingInvoiceId}
        />
      ))}

      {/* Modal Pembayaran Midtrans Snap (Embed) */}
      {snapInvoice && (
        <SnapPaymentModal
          opened={Boolean(snapInvoice)}
          onClose={() => {
            setSnapInvoice(null);
            router.refresh();
          }}
          invoiceId={snapInvoice.id}
          invoiceCode={snapInvoice.code}
          onSuccess={() => {
            setSnapInvoice(null);
            router.refresh();
          }}
          onPending={() => {
            setSnapInvoice(null);
            router.refresh();
          }}
          onError={() => {
            router.refresh();
          }}
        />
      )}

      <CreditHistory
        entries={props.entries}
        currentBalance={props.available}
      />
    </div>
  );
}
