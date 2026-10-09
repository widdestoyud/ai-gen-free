"use client";

import {
  Badge,
  Button,
  Card,
  CopyButton,
  FileInput,
  Group,
  LoadingOverlay,
  Modal,
  Pagination,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
  Loader,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState, useMemo, useCallback, useEffect } from "react";
import { ResponsiveTable } from "@/components/responsive-table";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { SnapPaymentModal } from "@/components/snap-payment-modal";
import { PackageCard } from "@/components/package-card";
import { buildPlanFromPackage } from "@/lib/pricing-packages";
import { requestJson } from "@/lib/api";
import { formatDateId, formatIdr } from "@/lib/format";
import { usePayment } from "@/hooks/use-payment";
import type { Invoice, Package } from "../types";
import classes from "./order-client.module.css";

function DownloadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function OrderClient(props: {
  packages: Package[];
  invoices: Invoice[];
  wallet?: { available: number; held: number };
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  isLoading?: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [manualEnabled, setManualEnabled] = useState(true);
  const [onlineEnabled, setOnlineEnabled] = useState(false);
  const [activeGateway, setActiveGateway] = useState<string | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

  // Choice modal when both manual & online are enabled
  const [choiceInvoice, setChoiceInvoice] = useState<{
    id: string;
    uniqueCode: string;
    amountIdr: number;
    points: number;
    name?: string;
  } | null>(null);

  // Snap Payment Modal state
  const [snapInvoice, setSnapInvoice] = useState<{ id: string; code: string } | null>(null);

  // Upload proof modal state
  const [uploadInvoice, setUploadInvoice] = useState<Invoice | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Cancel confirmation modal state
  const [cancelingInvoice, setCancelingInvoice] = useState<Invoice | null>(null);

  const {
    error: paymentError,
    clearError: clearPaymentError,
    initiatePayment,
    getPaymentMethods,
  } = usePayment();

  useEffect(() => {
    let mounted = true;
    void getPaymentMethods().then((res) => {
      if (!mounted) return;
      setManualEnabled(res.manualEnabled ?? true);
      setOnlineEnabled(res.onlineEnabled ?? false);
      setActiveGateway(res.activeOnlineGateway ?? null);
    });
    return () => {
      mounted = false;
    };
  }, [getPaymentMethods]);

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return props.invoices;
    return props.invoices.filter(
      (inv) =>
        inv.uniqueCode.toLowerCase().includes(q) ||
        inv.id.toLowerCase().includes(q) ||
        inv.statusLabel.toLowerCase().includes(q),
    );
  }, [props.invoices, search]);

  async function buy(packageId: string) {
    setError("");
    clearPaymentError();
    setBusy(true);
    const result = await requestJson<{ id: string; uniqueCode: string }>("/api/invoices", {
      method: "POST",
      body: JSON.stringify({ packageId }),
    });
    if (!result.ok) {
      setBusy(false);
      setError(result.message || "Gagal membuat pesanan");
      return;
    }
    if (!result.data?.id) {
      setBusy(false);
      setError("Gagal membuat pesanan");
      return;
    }

    const selectedPkg = props.packages.find((p) => p.id === packageId);
    const invoiceId = result.data.id;
    const invoiceCode = result.data.uniqueCode;
    const amountIdr = selectedPkg?.amountIdr ?? 0;
    const points = selectedPkg?.points ?? 0;

    // Skenario 1: Jika KEDUA metode pembayaran (Manual & Online) aktif
    // Pelanggan dapat memilih apakah transfer manual atau online payment
    if (manualEnabled && onlineEnabled) {
      setBusy(false);
      setChoiceInvoice({
        id: invoiceId,
        uniqueCode: invoiceCode,
        amountIdr,
        points,
        name: selectedPkg?.name,
      });
      router.refresh();
      return;
    }

    // Skenario 2: Jika HANYA Online Payment yang aktif
    // Langsung redirect ke URL checkout
    if (!manualEnabled && onlineEnabled) {
      const payRes = await initiatePayment(invoiceId);
      if (payRes?.paymentUrl) {
        window.location.href = payRes.paymentUrl;
        return;
      }
      setBusy(false);
      router.refresh();
      return;
    }

    // Skenario 3: Jika HANYA Manual Payment yang aktif (atau default)
    // Langsung buka modal unggah bukti transfer
    setUploadInvoice({
      id: invoiceId,
      uniqueCode: invoiceCode,
      amountIdr,
      points,
      status: "unpaid",
      statusLabel: "Belum Bayar",
      hasProof: false,
    });

    setBusy(false);
    router.refresh();
  }

  async function handleUploadProof() {
    if (!uploadInvoice || !selectedFile) return;
    setError("");
    setBusy(true);
    const form = new FormData();
    form.set("file", selectedFile);
    const result = await requestJson(`/api/invoices/${uploadInvoice.id}/proof`, {
      method: "POST",
      body: form,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setUploadInvoice(null);
    setSelectedFile(null);
    router.refresh();
  }

  const handlePayGateway = useCallback(
    async (invoiceId: string, _invoiceCode: string) => {
      setError("");
      clearPaymentError();
      setPayingInvoiceId(invoiceId);
      const payRes = await initiatePayment(invoiceId);
      if (payRes?.paymentUrl) {
        window.location.href = payRes.paymentUrl;
        return;
      }
      setPayingInvoiceId(null);
      if (!payRes) {
        setError("Gagal memulai pembayaran online. Silakan coba lagi.");
      }
    },
    [clearPaymentError, initiatePayment],
  );

  async function handleConfirmCancel() {
    if (!cancelingInvoice) return;
    setError("");
    setBusy(true);
    const result = await requestJson(`/api/invoices/${cancelingInvoice.id}/cancel`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setCancelingInvoice(null);
    router.refresh();
  }

  function exportCsv() {
    if (filteredInvoices.length === 0) return;
    const headers = ["Invoice ID", "Kode Unik", "Nominal (IDR)", "Poin", "Status", "Metode", "Tanggal"];
    const rows = filteredInvoices.map((inv) => [
      `"${inv.id}"`,
      `"${inv.uniqueCode}"`,
      `"${inv.amountIdr}"`,
      `"${inv.points}"`,
      `"${inv.statusLabel}"`,
      `"${inv.gateway?.paymentChannel ? inv.gateway.paymentChannel : "Manual Transfer"}"`,
      `"${inv.createdAt ? formatDateId(inv.createdAt) : "-"}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `riwayat-invoice-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const displayError = error || paymentError;

  return (
    <div className={classes.orderContainer}>
      {props.wallet ? (
        <Paper
          p="md"
          radius="md"
          withBorder
          mb="xl"
          style={{
            background: "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)",
            borderColor: "rgba(59, 130, 246, 0.25)",
          }}
        >
          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" tt="uppercase" fw={700} c="dimmed" lts="0.05em">
                Saldo Sparks Anda Saat Ini
              </Text>
              <Group gap="xs" align="baseline">
                <Text size="xl" fw={800} c="#60a5fa">
                  {props.wallet.available.toLocaleString()} Sparks
                </Text>
                {props.wallet.held > 0 ? (
                  <Text size="xs" c="dimmed">
                    ({props.wallet.held.toLocaleString()} terkunci dalam antrian proses render)
                  </Text>
                ) : null}
              </Group>
            </div>
          </Group>
        </Paper>
      ) : null}

      <Text className={classes.sectionTitle}>Pilih Paket Poin</Text>

      <Text className={classes.sectionSubtitle}>
        Pilih paket poin di bawah ini, lakukan pembayaran transfer bank / QRIS sesuai invoice yang diterbitkan, lalu unggah bukti transfer. Poin akan langsung diproses dan ditambahkan ke saldo Anda.
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg" className={classes.packagesGrid}>
        {props.packages.map((pkg, idx) => {
          const plan = buildPlanFromPackage(pkg, idx, props.packages.length);
          return (
            <PackageCard
              key={plan.id}
              id={plan.id}
              name={plan.name}
              label={plan.label}
              badgeText={plan.badgeText}
              description={plan.description}
              price={plan.price}
              originalPrice={plan.originalPrice}
              points={plan.points}
              popular={plan.popular}
              perks={plan.perks}
              buttonLabel={`Pilih ${plan.name}`}
              disabled={busy}
              onSelect={(id) => {
                router.push(`/checkout?packageId=${id}`);
              }}
            />
          );
        })}
      </SimpleGrid>

      <ErrorAlert message={displayError} />

      {/* Tabel Riwayat Invoice */}
      <Paper className={classes.tableContainer} pos="relative">
        <LoadingOverlay
          visible={Boolean(props.isLoading)}
          overlayProps={{ radius: "sm", blur: 1 }}
          loaderProps={{ size: "sm" }}
        />
        <div className={classes.tableHeaderRow}>
          <Stack gap={2}>
            <Text className={classes.sectionTitle}>Riwayat Invoice</Text>
            <Text className={classes.sectionSubtitle}>
              Daftar tagihan dan status verifikasi pemesanan poin generate Anda.
            </Text>
          </Stack>

          <Group gap="xs">
            <TextInput
              size="xs"
              placeholder="Cari kode invoice..."
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              leftSection={<SearchIcon />}
            />
            <Button
              size="xs"
              variant="default"
              leftSection={<DownloadIcon />}
              onClick={exportCsv}
              disabled={filteredInvoices.length === 0}
            >
              Export CSV
            </Button>
          </Group>
        </div>

        {filteredInvoices.length === 0 ? (
          <EmptyState minHeight={180}>
            {search
              ? `Tidak ada invoice yang cocok dengan pencarian "${search}".`
              : "Belum ada riwayat invoice pemesanan poin."}
          </EmptyState>
        ) : (
          <ResponsiveTable
            data={filteredInvoices}
            keyExtractor={(inv) => inv.id}
            renderHeader={() => (
              <Table.Tr className={classes.tableHeader}>
                <Table.Th>Kode Invoice</Table.Th>
                <Table.Th>Nominal & Poin</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Tanggal Dibuat</Table.Th>
                <Table.Th className={classes.actionCell}>Aksi / Pembayaran</Table.Th>
              </Table.Tr>
            )}
            renderRow={(inv) => {
              const isCanceled = inv.status === "canceled";
              const isPaid = inv.status === "paid";
              const isAwaiting = inv.status === "awaiting_review";
              const isRejected = inv.status === "rejected";
              const hasGatewaySession = inv.gateway?.paymentUrl && inv.gateway?.expiredAt;
              const gatewayExpired = hasGatewaySession && new Date(inv.gateway!.expiredAt!) < new Date();
              const isExpired = inv.status === "expired" || gatewayExpired;
              const isUnpaid = inv.status === "unpaid" && !isExpired;
              const canPay = (isUnpaid || isRejected) && !isExpired;
              const canCancel = (isUnpaid || isRejected || isAwaiting) && !isExpired;
              const isPaying = payingInvoiceId === inv.id;

              const isExplicitManual = inv.paymentMethod === "manual";
              const isExplicitOnline =
                inv.paymentMethod === "online" ||
                inv.paymentMethod === "midtrans" ||
                inv.paymentMethod === "xendit" ||
                inv.paymentMethod === "doku" ||
                inv.paymentMethod === "dana" ||
                Boolean(inv.gateway?.paymentUrl || inv.paymentGateway);
              const showOnlineButton = !isExplicitManual && onlineEnabled && (isExplicitOnline || !manualEnabled);
              const showManualButton = isExplicitManual ? manualEnabled : (!onlineEnabled && manualEnabled) || (!isExplicitOnline && manualEnabled);

              const onlineGatewayLabel =
                activeGateway === "midtrans"
                  ? "Midtrans"
                  : activeGateway === "doku"
                    ? "DOKU"
                    : activeGateway === "dana"
                      ? "DANA"
                      : activeGateway === "xendit"
                        ? "Xendit"
                        : "Online";

              return (
                <Table.Tr key={inv.id} className={classes.tableRow}>
                  <Table.Td>
                    <div className={classes.codeCell}>
                      <span className={classes.uniqueCode}>{inv.uniqueCode}</span>
                      <span className={classes.invoiceIdText}>ID: {inv.id}</span>
                    </div>
                  </Table.Td>

                  <Table.Td>
                    <div className={classes.amountCell}>
                      <span className={classes.amountValue}>{formatIdr(inv.amountIdr)}</span>
                      <span className={classes.pointsValue}>+{inv.points} Poin</span>
                    </div>
                  </Table.Td>

                  <Table.Td>
                    <Stack gap={4}>
                      <Group gap="xs">
                        <Badge
                          color={
                            isPaid
                              ? "teal"
                              : isAwaiting
                                ? "yellow"
                                : isRejected
                                  ? "red"
                                  : isCanceled || isExpired
                                    ? "gray"
                                    : "blue"
                          }
                          size="sm"
                          radius="sm"
                          variant={isCanceled || isExpired ? "outline" : "light"}
                        >
                          {isExpired ? "Kedaluwarsa" : inv.statusLabel}
                        </Badge>
                      </Group>
                      {isRejected && (
                        <div
                          style={{
                            background: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.25)",
                            borderRadius: 6,
                            padding: "4px 8px",
                            maxWidth: 240,
                          }}
                        >
                          <Text size="xs" c="red.3" fw={500}>
                            {inv.reviewNote ? `Alasan: ${inv.reviewNote}` : "Bukti ditolak. Silakan unggah ulang bukti yang valid."}
                          </Text>
                        </div>
                      )}
                    </Stack>
                  </Table.Td>

                  <Table.Td className={classes.dateCell} suppressHydrationWarning>
                    {inv.createdAt ? formatDateId(inv.createdAt) : "-"}
                    {inv.paidAt && isPaid ? (
                      <Text size="xs" c="teal" suppressHydrationWarning>
                        Lunas: {formatDateId(inv.paidAt)}
                        {inv.gateway?.paymentChannel ? ` (${inv.gateway.paymentChannel})` : ""}
                      </Text>
                    ) : null}
                  </Table.Td>

                  <Table.Td className={classes.actionCell}>
                    {canPay ? (
                      <Group gap="xs" justify="flex-end">
                        {showOnlineButton ? (
                          <Button
                            size="xs"
                            variant="gradient"
                            gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
                            disabled={busy || isPaying}
                            leftSection={isPaying ? <Loader size="xs" /> : null}
                            onClick={() => handlePayGateway(inv.id, inv.uniqueCode)}
                          >
                            {isPaying
                              ? "Memproses..."
                              : hasGatewaySession && !gatewayExpired
                                ? "Lanjut Bayar Online"
                                : `Bayar Online (${onlineGatewayLabel})`}
                          </Button>
                        ) : null}

                        {showManualButton ? (
                          <Button
                            size="xs"
                            variant={isRejected ? "filled" : "light"}
                            color={isRejected ? "orange" : "blue"}
                            onClick={() => {
                              setUploadInvoice(inv);
                              setSelectedFile(null);
                            }}
                            disabled={busy}
                          >
                            {isRejected ? "Unggah Ulang Bukti" : "Unggah Bukti"}
                          </Button>
                        ) : null}

                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          disabled={busy || isPaying}
                          onClick={() => setCancelingInvoice(inv)}
                        >
                          Batalkan
                        </Button>
                      </Group>
                    ) : isAwaiting ? (
                      <Text size="xs" c="dimmed">
                        Menunggu kurasi admin
                      </Text>
                    ) : isPaid ? (
                      <Text size="xs" c="teal">
                        Poin sudah ditambahkan
                      </Text>
                    ) : isCanceled ? (
                      <Text size="xs" c="dimmed">
                        Pesanan dibatalkan
                      </Text>
                    ) : isExpired ? (
                      <Text size="xs" c="dimmed">
                        Pesanan kedaluwarsa
                      </Text>
                    ) : null}
                  </Table.Td>
                </Table.Tr>
              );
            }}
            renderMobileCard={(inv) => {
              const isCanceled = inv.status === "canceled";
              const isPaid = inv.status === "paid";
              const isAwaiting = inv.status === "awaiting_review";
              const isRejected = inv.status === "rejected";
              const hasGatewaySession = inv.gateway?.paymentUrl && inv.gateway?.expiredAt;
              const gatewayExpired = hasGatewaySession && new Date(inv.gateway!.expiredAt!) < new Date();
              const isExpired = inv.status === "expired" || gatewayExpired;
              const isUnpaid = inv.status === "unpaid" && !isExpired;
              const canPay = (isUnpaid || isRejected) && !isExpired;
              const canCancel = (isUnpaid || isRejected || isAwaiting) && !isExpired;
              const isPaying = payingInvoiceId === inv.id;

              const isExplicitManual = inv.paymentMethod === "manual";
              const isExplicitOnline =
                inv.paymentMethod === "online" ||
                inv.paymentMethod === "midtrans" ||
                inv.paymentMethod === "xendit" ||
                inv.paymentMethod === "doku" ||
                inv.paymentMethod === "dana" ||
                Boolean(inv.gateway?.paymentUrl || inv.paymentGateway);
              const showOnlineButton = !isExplicitManual && onlineEnabled && (isExplicitOnline || !manualEnabled);
              const showManualButton = isExplicitManual ? manualEnabled : (!onlineEnabled && manualEnabled) || (!isExplicitOnline && manualEnabled);

              const onlineGatewayLabel =
                activeGateway === "midtrans"
                  ? "Midtrans"
                  : activeGateway === "doku"
                    ? "DOKU"
                    : activeGateway === "dana"
                      ? "DANA"
                      : activeGateway === "xendit"
                        ? "Xendit"
                        : "Online";

              return (
                <div key={inv.id} className={classes.mobileInvoiceCard}>
                  <div className={classes.mobileInvoiceTop}>
                    <div>
                      <Text fw={700} size="sm" c="blue.4">
                        {inv.uniqueCode}
                      </Text>
                      <Text size="xs" c="dimmed" style={{ fontFamily: "monospace" }}>
                        ID: {inv.id}
                      </Text>
                    </div>
                    <Group gap={6}>
                      <Badge
                        color={
                          isPaid
                            ? "teal"
                            : isAwaiting
                              ? "yellow"
                              : isRejected
                                ? "red"
                                : isCanceled || isExpired
                                  ? "gray"
                                  : "blue"
                        }
                        size="sm"
                        radius="sm"
                        variant={isCanceled || isExpired ? "outline" : "light"}
                      >
                        {isExpired ? "Kedaluwarsa" : inv.statusLabel}
                      </Badge>
                    </Group>
                  </div>

                  <div className={classes.mobileInvoiceMiddle}>
                    <div>
                      <Text size="xs" c="dimmed">
                        Nominal
                      </Text>
                      <Text fw={700} size="sm">
                        {formatIdr(inv.amountIdr)}
                      </Text>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <Text size="xs" c="teal.4" fw={600}>
                        +{inv.points} Poin
                      </Text>
                      <Text size="xs" c="dimmed" suppressHydrationWarning>
                        {inv.createdAt ? formatDateId(inv.createdAt) : "-"}
                      </Text>
                    </div>
                  </div>

                  {isRejected && (
                    <div
                      style={{
                        background: "rgba(239, 68, 68, 0.12)",
                        border: "1px solid rgba(239, 68, 68, 0.25)",
                        borderRadius: 8,
                        padding: "8px 12px",
                      }}
                    >
                      <Text size="xs" fw={700} c="red.4" mb={2}>
                        ⚠️ Bukti Pembayaran Ditolak Admin:
                      </Text>
                      <Text size="xs" c="red.2">
                        {inv.reviewNote || "Bukti ditolak. Silakan unggah ulang bukti transfer yang valid."}
                      </Text>
                    </div>
                  )}

                  {inv.paidAt && isPaid ? (
                    <Text size="xs" c="teal.4" suppressHydrationWarning>
                      Lunas: {formatDateId(inv.paidAt)}
                      {inv.gateway?.paymentChannel ? ` (${inv.gateway.paymentChannel})` : ""}
                    </Text>
                  ) : null}

                  <div className={classes.mobileInvoiceBottom}>
                    {canPay ? (
                      <Group gap="xs" justify="flex-end" style={{ width: "100%" }}>
                        {showOnlineButton ? (
                          <Button
                            size="xs"
                            variant="gradient"
                            gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
                            disabled={busy || isPaying}
                            leftSection={isPaying ? <Loader size="xs" /> : null}
                            onClick={() => handlePayGateway(inv.id, inv.uniqueCode)}
                          >
                            {isPaying ? "Memproses..." : `Bayar Online (${onlineGatewayLabel})`}
                          </Button>
                        ) : null}

                        {showManualButton ? (
                          <Button
                            size="xs"
                            variant={isRejected ? "filled" : "light"}
                            color={isRejected ? "orange" : "blue"}
                            onClick={() => {
                              setUploadInvoice(inv);
                              setSelectedFile(null);
                            }}
                            disabled={busy}
                          >
                            {isRejected ? "Unggah Ulang Bukti" : "Unggah Bukti"}
                          </Button>
                        ) : null}

                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          disabled={busy || isPaying}
                          onClick={() => setCancelingInvoice(inv)}
                        >
                          Batalkan
                        </Button>
                      </Group>
                    ) : isAwaiting ? (
                      <Text size="xs" c="dimmed">
                        Menunggu kurasi admin
                      </Text>
                    ) : isPaid ? (
                      <Text size="xs" c="teal.4">
                        Poin sudah ditambahkan
                      </Text>
                    ) : isCanceled ? (
                      <Text size="xs" c="dimmed">
                        Pesanan dibatalkan
                      </Text>
                    ) : isExpired ? (
                      <Text size="xs" c="dimmed">
                        Pesanan kedaluwarsa
                      </Text>
                    ) : null}
                  </div>
                </div>
              );
            }}
          />
        )}

        {props.pagination && props.pagination.total > 0 && (
          <Group justify="space-between" align="center" mt="md" wrap="wrap" gap="sm">
            <Text size="xs" c="dimmed">
              Menampilkan <strong>{props.pagination.total === 0 ? 0 : (props.pagination.page - 1) * props.pagination.limit + 1}–{Math.min(props.pagination.page * props.pagination.limit, props.pagination.total)}</strong> dari{" "}
              <strong>{props.pagination.total}</strong> riwayat invoice
            </Text>
            {props.pagination.totalPages > 1 && props.onPageChange && (
              <Pagination
                size="sm"
                total={props.pagination.totalPages}
                value={props.pagination.page}
                onChange={props.onPageChange}
                disabled={props.isLoading}
              />
            )}
          </Group>
        )}
      </Paper>

      {/* Modal Upload Bukti Transfer & Rincian Pembayaran */}
      <Modal
        opened={Boolean(uploadInvoice)}
        onClose={() => {
          if (!busy) {
            setUploadInvoice(null);
            setSelectedFile(null);
          }
        }}
        title={
          <Group gap="xs">
            <Text fw={700} size="md">
              {uploadInvoice?.status === "rejected"
                ? "Unggah Ulang Bukti Pembayaran"
                : "Pembayaran QRIS & Bukti Transfer"}
            </Text>
            {uploadInvoice?.uniqueCode && (
              <Badge variant="light" color={uploadInvoice?.status === "rejected" ? "red" : "blue"} size="sm">
                {uploadInvoice.uniqueCode}
              </Badge>
            )}
          </Group>
        }
        centered
        size="lg"
        radius="lg"
        padding="lg"
      >
        <Stack gap="md">
          {/* Rejection Alert if previously rejected */}
          {uploadInvoice?.status === "rejected" && (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: 8,
                padding: "10px 14px",
              }}
            >
              <Text size="xs" fw={700} c="red.3" mb={2}>
                ⚠️ Bukti Sebelumnya Ditolak Admin:
              </Text>
              <Text size="xs" c="red.2">
                {uploadInvoice.reviewNote
                  ? uploadInvoice.reviewNote
                  : "Bukti transfer tidak valid atau tidak sesuai. Pastikan mengunggah struk / tangkapan layar transfer yang jelas dan valid."}
              </Text>
            </div>
          )}

          {/* Summary Box */}
          <div className={classes.modalSummaryCard}>
            <Group justify="space-between" align="center">
              <div>
                <Text size="xs" c="dimmed">
                  Total Tagihan Pembayaran
                </Text>
                <Text size="xl" fw={800} c="blue.4">
                  {uploadInvoice ? formatIdr(uploadInvoice.amountIdr) : "—"}
                </Text>
              </div>
              <div style={{ textAlign: "right" }}>
                <Text size="xs" c="dimmed">
                  Sparks Diperoleh
                </Text>
                <Text size="md" fw={700} c="green.4">
                  +{uploadInvoice?.points?.toLocaleString()} Sparks
                </Text>
              </div>
            </Group>
          </div>

          {/* QRIS Card Section */}
          <div className={classes.qrisSection}>
            <Text size="xs" fw={700} c="dark.7" mb={6} style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
              Scan QRIS untuk Pembayaran
            </Text>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/qris-payment.png"
              alt="QRIS Pembayaran Satulabs - WAY2ND, GAMING"
              className={classes.qrisImage}
            />
            <Group gap="xs" mt={10} justify="center">
              <Badge color="blue" variant="filled" size="sm">
                Merchant: WAY2ND, GAMING
              </Badge>
              <Badge color="gray" variant="outline" size="sm">
                NMID: ID1026482092164
              </Badge>
            </Group>
            <Button
              component="a"
              href="/images/qris-payment.png"
              target="_blank"
              rel="noopener noreferrer"
              size="xs"
              variant="subtle"
              color="dark"
              mt={6}
            >
              Lihat / Perbesar Gambar QRIS ↗
            </Button>
          </div>

          {/* Step-by-Step Instructions */}
          <div className={classes.instructionBox}>
            <Text size="xs" fw={700} c="blue.3" mb="xs">
              Instruksi Pembayaran Manual:
            </Text>
            <Stack gap="xs">
              <div className={classes.instructionStep}>
                <div className={classes.stepNumber}>1</div>
                <Text size="xs" c="gray.3">
                  <strong>Pindai (Scan) QRIS</strong> di atas menggunakan e-wallet (GoPay, OVO, DANA, ShopeePay, LinkAja) atau aplikasi Mobile Banking (BCA, Mandiri, BRI, BNI, Jago, dll).
                </Text>
              </div>
              <div className={classes.instructionStep}>
                <div className={classes.stepNumber}>2</div>
                <Text size="xs" c="gray.3">
                  <strong>Masukkan nominal manual</strong> tepat sebesar{" "}
                  <strong style={{ color: "#60a5fa" }}>
                    {uploadInvoice ? formatIdr(uploadInvoice.amountIdr) : ""}
                  </strong>{" "}
                  (sesuai harga paket).
                </Text>
              </div>
              <div className={classes.instructionStep}>
                <div className={classes.stepNumber}>3</div>
                <Text size="xs" c="gray.3">
                  Selesaikan transaksi dan <strong>simpan struk atau tangkapan layar (screenshot) bukti pembayaran</strong> Anda.
                </Text>
              </div>
              <div className={classes.instructionStep}>
                <div className={classes.stepNumber}>4</div>
                <Text size="xs" c="gray.3">
                  <strong>Unggah bukti pembayaran</strong> pada formulir di bawah ini, lalu klik tombol <strong>Kirim Bukti Pembayaran</strong>.
                </Text>
              </div>
            </Stack>
          </div>

          {/* File Input */}
          <FileInput
            label="Unggah File Bukti Pembayaran"
            description="Format yang didukung: JPG, PNG, WebP, atau PDF (maks. 5MB)"
            placeholder="Pilih foto / tangkapan layar bukti transfer..."
            accept="image/jpeg,image/png,image/webp,application/pdf"
            value={selectedFile}
            onChange={setSelectedFile}
            disabled={busy}
            required
            size="sm"
            radius="md"
          />

          {/* Actions */}
          <Group justify="flex-end" mt="xs" gap="sm">
            <Button
              variant="default"
              onClick={() => {
                setUploadInvoice(null);
                setSelectedFile(null);
              }}
              disabled={busy}
            >
              Tutup
            </Button>
            <Button
              variant="gradient"
              gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
              onClick={() => void handleUploadProof()}
              disabled={!selectedFile || busy}
              loading={busy}
              fw={700}
            >
              Kirim Bukti Pembayaran
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal Konfirmasi Batal Pesanan */}
      <Modal
        opened={Boolean(cancelingInvoice)}
        onClose={() => {
          if (!busy) setCancelingInvoice(null);
        }}
        title={
          <Group gap="xs">
            <Text fw={700} size="md" c="red.4">
              Batalkan Pesanan?
            </Text>
            {cancelingInvoice?.uniqueCode && (
              <Badge variant="light" color="red" size="sm">
                {cancelingInvoice.uniqueCode}
              </Badge>
            )}
          </Group>
        }
        centered
        size="md"
        radius="lg"
        padding="lg"
      >
        <Stack gap="md">
          <div className={classes.cancelModalCard}>
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed">
                Nomor Tagihan
              </Text>
              <Text size="sm" fw={600}>
                {cancelingInvoice?.uniqueCode}
              </Text>
            </Group>
            <Group justify="space-between" mb="xs">
              <Text size="xs" c="dimmed">
                Total Nominal
              </Text>
              <Text size="sm" fw={700} c="red.4">
                {cancelingInvoice ? formatIdr(cancelingInvoice.amountIdr) : ""}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                Jumlah Paket
              </Text>
              <Text size="sm" fw={600}>
                +{cancelingInvoice?.points} Sparks
              </Text>
            </Group>
          </div>

          <Text size="xs" c="dimmed">
            Setelah dibatalkan, tagihan ini tidak dapat diproses lagi dan Anda dapat membuat pesanan baru kapan saja.
          </Text>

          <Group justify="flex-end" mt="xs" gap="sm">
            <Button
              variant="default"
              onClick={() => setCancelingInvoice(null)}
              disabled={busy}
            >
              Kembali
            </Button>
            <Button
              color="red"
              variant="filled"
              onClick={() => void handleConfirmCancel()}
              loading={busy}
              fw={600}
            >
              Ya, Batalkan Pesanan
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal Pilihan Metode Pembayaran (Jika Manual & Online Gateway keduanya aktif) */}
      <Modal
        opened={Boolean(choiceInvoice)}
        onClose={() => {
          if (!busy) setChoiceInvoice(null);
        }}
        title={
          <Group gap="xs">
            <Text fw={700} size="md">
              Pilih Metode Pembayaran
            </Text>
            {choiceInvoice?.uniqueCode && (
              <Badge variant="light" color="blue" size="sm">
                {choiceInvoice.uniqueCode}
              </Badge>
            )}
          </Group>
        }
        centered
        size="md"
        radius="lg"
        padding="lg"
      >
        <Stack gap="md">
          <div className={classes.modalSummaryCard}>
            <Group justify="space-between" align="center">
              <div>
                <Text size="xs" c="dimmed">
                  Total Tagihan Pembayaran
                </Text>
                <Text size="xl" fw={800} c="blue.4">
                  {choiceInvoice ? formatIdr(choiceInvoice.amountIdr) : "—"}
                </Text>
              </div>
              <div style={{ textAlign: "right" }}>
                <Text size="xs" c="dimmed">
                  Sparks Diperoleh
                </Text>
                <Text size="md" fw={700} c="green.4">
                  +{choiceInvoice?.points?.toLocaleString()} Sparks
                </Text>
              </div>
            </Group>
          </div>

          <Text size="xs" c="dimmed">
            Pilih cara pembayaran yang Anda inginkan untuk menyelesaikan pesanan:
          </Text>

          {/* Opsi 1: Online Gateway (Xendit / Midtrans) */}
          <Paper
            p="md"
            withBorder
            radius="md"
            style={{
              cursor: busy ? "not-allowed" : "pointer",
              transition: "border-color 0.2s, transform 0.1s",
              border: "1px solid rgba(59, 130, 246, 0.4)",
              background: "rgba(59, 130, 246, 0.04)",
            }}
            onClick={async () => {
              if (busy || !choiceInvoice) return;
              setBusy(true);
              const payRes = await initiatePayment(choiceInvoice.id);
              if (payRes?.paymentUrl) {
                window.location.href = payRes.paymentUrl;
                return;
              }
              setBusy(false);
            }}
          >
            <Group justify="space-between" align="center" wrap="nowrap">
              <Stack gap={2}>
                <Group gap="xs">
                  <Text fw={700} size="sm" c="blue.4">
                    Bayar Online Otomatis ({activeGateway === "midtrans" ? "Midtrans" : "Xendit"})
                  </Text>
                  <Badge color="blue" size="xs" variant="filled">
                    Instan
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  QRIS, Virtual Account (BCA, Mandiri, BNI, BRI), E-Wallet (GoPay, DANA, OVO, ShopeePay).
                </Text>
                <Text size="xs" c="blue.3" fw={500} mt={2}>
                  Masa berlaku: 10 menit
                </Text>
              </Stack>
              <Button
                size="xs"
                variant="gradient"
                gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
                loading={busy}
              >
                Bayar Online →
              </Button>
            </Group>
          </Paper>

          {/* Opsi 2: Transfer Manual */}
          <Paper
            p="md"
            withBorder
            radius="md"
            style={{
              cursor: "pointer",
              transition: "border-color 0.2s",
            }}
            onClick={() => {
              if (!choiceInvoice) return;
              const inv = choiceInvoice;
              setChoiceInvoice(null);
              setUploadInvoice({
                id: inv.id,
                uniqueCode: inv.uniqueCode,
                amountIdr: inv.amountIdr,
                points: inv.points,
                status: "unpaid",
                statusLabel: "Belum Bayar",
                hasProof: false,
              });
            }}
          >
            <Group justify="space-between" align="center" wrap="nowrap">
              <Stack gap={2}>
                <Group gap="xs">
                  <Text fw={700} size="sm">
                    Transfer Manual (QRIS Satulabs)
                  </Text>
                  <Badge color="gray" size="xs" variant="light">
                    Verifikasi Admin
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  Pindai QRIS merchant WAY2ND, GAMING dan unggah bukti transfer.
                </Text>
                <Text size="xs" c="dimmed" fw={500} mt={2}>
                  Masa berlaku: 1 jam (60 menit)
                </Text>
              </Stack>
              <Button
                size="xs"
                variant="light"
                color="blue"
              >
                Pilih Manual →
              </Button>
            </Group>
          </Paper>

          <Group justify="flex-end" mt="xs">
            <Button
              variant="subtle"
              color="gray"
              size="xs"
              onClick={() => setChoiceInvoice(null)}
              disabled={busy}
            >
              Tutup
            </Button>
          </Group>
        </Stack>
      </Modal>

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
    </div>
  );
}
