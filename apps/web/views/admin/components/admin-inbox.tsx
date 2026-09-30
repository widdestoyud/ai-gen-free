"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Divider,
  Group,
  Image,
  Modal,
  Pagination,
  Paper,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import { AppLink } from "@/components/app-link";
import { ResponsiveTable } from "@/components/responsive-table";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { requestJson } from "@/lib/api";
import { formatDateId, formatIdr } from "@/lib/format";
import type { AdminInvoiceItem, PaginationMeta } from "@/app/admin/page";
import classes from "./admin-inbox.module.css";

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

function RefreshIcon() {
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
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  );
}

export function AdminInbox({
  items: _items,
  openItems: _openItems = [],
  allInvoices = [],
  pendingCount = 0,
  openCount = 0,
  pagination = {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
  currentParams,
}: {
  items?: AdminInvoiceItem[];
  openItems?: AdminInvoiceItem[];
  allInvoices?: AdminInvoiceItem[];
  pendingCount?: number;
  openCount?: number;
  pagination?: PaginationMeta;
  currentParams?: {
    page?: string;
    limit?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
    q?: string;
  };
}) {
  const router = useRouter();
  const activeTab = currentParams?.status || "all";
  const [search, setSearch] = useState(currentParams?.q || "");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Modal Bukti Bayar & Kurasi state
  const [previewItem, setPreviewItem] = useState<AdminInvoiceItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Modal Konfirmasi Terima
  const [approvingItem, setApprovingItem] = useState<AdminInvoiceItem | null>(null);

  // Modal Konfirmasi Batal Admin
  const [cancelingItem, setCancelingItem] = useState<AdminInvoiceItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Modal QR Info state
  const [qrModalInfo, setQrModalInfo] = useState<{
    code: string;
    qrString?: string;
    qrUrl?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Loading state per invoice untuk Cek Status Midtrans
  const [checkingInvoiceId, setCheckingInvoiceId] = useState<string | null>(null);

  function navigateQuery(overrides: {
    status?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
    q?: string;
  }) {
    const params = new URLSearchParams();

    const nextStatus =
      overrides.status !== undefined ? overrides.status : currentParams?.status || "";
    const nextPage =
      overrides.page !== undefined
        ? String(overrides.page)
        : overrides.status !== undefined ||
            overrides.q !== undefined ||
            overrides.limit !== undefined ||
            overrides.sortBy !== undefined
          ? "1"
          : currentParams?.page || "1";
    const nextLimit =
      overrides.limit !== undefined ? String(overrides.limit) : currentParams?.limit || "10";
    const nextSortBy =
      overrides.sortBy !== undefined ? overrides.sortBy : currentParams?.sortBy || "";
    const nextSortOrder =
      overrides.sortOrder !== undefined ? overrides.sortOrder : currentParams?.sortOrder || "";
    const nextQ = overrides.q !== undefined ? overrides.q : currentParams?.q || "";

    if (nextStatus && nextStatus !== "all") params.set("status", nextStatus);
    if (nextPage && nextPage !== "1") params.set("page", nextPage);
    if (nextLimit && nextLimit !== "10") params.set("limit", nextLimit);
    if (nextSortBy) params.set("sortBy", nextSortBy);
    if (nextSortOrder) params.set("sortOrder", nextSortOrder);
    if (nextQ.trim()) params.set("q", nextQ.trim());

    const qs = params.toString();
    router.push(`/admin${qs ? `?${qs}` : ""}`);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigateQuery({ q: search, page: 1 });
  }

  async function loadProof(item: AdminInvoiceItem) {
    setError("");
    setSuccessMessage("");
    setBusy(true);
    const result = await requestJson<{ url?: string; contentType?: string }>(
      `/api/admin/invoices/${item.invoiceId}/proof`,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPreviewItem(item);
    setPreviewType(result.data.contentType ?? null);
    setPreviewUrl(`/api/admin/invoices/${item.invoiceId}/file`);
    setRejectReason("");
    setShowRejectForm(false);
  }

  async function handleApprove() {
    if (!approvingItem) return;
    setBusy(true);
    setError("");
    setSuccessMessage("");
    const result = await requestJson(`/api/admin/invoices/${approvingItem.invoiceId}/approve`, {
      method: "POST",
      body: "{}",
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setApprovingItem(null);
    setPreviewItem(null);
    setPreviewUrl(null);
    setPreviewType(null);
    setSuccessMessage(`Invoice ${approvingItem.uniqueCode} berhasil disetujui.`);
    router.refresh();
  }

  async function handleReject() {
    if (!previewItem) return;
    setBusy(true);
    setError("");
    setSuccessMessage("");
    const result = await requestJson(`/api/admin/invoices/${previewItem.invoiceId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason: rejectReason.trim() }),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPreviewItem(null);
    setPreviewUrl(null);
    setPreviewType(null);
    setRejectReason("");
    setShowRejectForm(false);
    setSuccessMessage(`Invoice ${previewItem.uniqueCode} telah ditolak.`);
    router.refresh();
  }

  async function handleCancelByAdmin() {
    if (!cancelingItem) return;
    setBusy(true);
    setError("");
    setSuccessMessage("");
    const result = await requestJson(`/api/admin/invoices/${cancelingItem.invoiceId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: cancelReason.trim() || undefined }),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const targetCode = cancelingItem.uniqueCode;
    setCancelingItem(null);
    setCancelReason("");
    setSuccessMessage(`Pesanan invoice ${targetCode} berhasil dibatalkan.`);
    router.refresh();
  }

  async function handleCheckGatewayStatus(invoiceId: string, uniqueCode: string) {
    setError("");
    setSuccessMessage("");
    setCheckingInvoiceId(invoiceId);
    try {
      const result = await requestJson<{
        status?: string;
        paymentChannel?: string;
        qrString?: string;
        qrUrl?: string;
        message?: string;
      }>(`/api/admin/invoices/${invoiceId}/payment-status`);

      if (!result.ok) {
        setError(result.message || `Gagal memeriksa status Midtrans untuk ${uniqueCode}`);
        return;
      }

      const status = result.data?.status ?? "unknown";
      const message = result.data?.message;
      setSuccessMessage(
        `Status ${uniqueCode}: ${status.toUpperCase()}${message ? ` (${message})` : ""}`,
      );

      if (result.data?.qrString) {
        setQrModalInfo({
          code: uniqueCode,
          qrString: result.data.qrString,
          qrUrl: result.data.qrUrl,
        });
      }

      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan saat memeriksa gateway";
      setError(msg);
    } finally {
      setCheckingInvoiceId(null);
    }
  }

  function exportCsv() {
    if (allInvoices.length === 0) return;
    const headers = [
      "Invoice ID",
      "Kode Unik",
      "Email",
      "Nominal (IDR)",
      "Poin",
      "Metode",
      "Channel",
      "Waktu Dibuat",
      "Waktu Submit Bukti",
      "Status",
    ];
    const rows = allInvoices.map((item) => [
      `"${item.invoiceId}"`,
      `"${item.uniqueCode}"`,
      `"${item.email}"`,
      `"${item.amountIdr}"`,
      `"${item.points}"`,
      `"${item.paymentMethod ?? "manual"}"`,
      `"${item.gatewayPaymentChannel ?? "-"}"`,
      `"${item.createdAt ? formatDateId(item.createdAt) : "-"}"`,
      `"${item.proofSubmittedAt ? formatDateId(item.proofSubmittedAt) : "-"}"`,
      `"${item.status}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `invoices-admin-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const startItem = pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className={classes.inboxContainer}>
      {/* Stat Metric Grid */}
      <div className={classes.statGrid}>
        <Paper className={classes.statCard}>
          <Text size="xs" c="dimmed" fw={500}>
            Menunggu Kurasi
          </Text>
          <Text size="xl" fw={700} c="yellow">
            {pendingCount}
          </Text>
          <Text size="xs" c="dimmed">
            Bukti transfer manual butuh persetujuan
          </Text>
        </Paper>

        <Paper className={classes.statCard}>
          <Text size="xs" c="dimmed" fw={500}>
            Pesanan Sedang Open
          </Text>
          <Text size="xl" fw={700} c="blue">
            {openCount}
          </Text>
          <Text size="xs" c="dimmed">
            Order aktif belum dibayar / sesi Midtrans
          </Text>
        </Paper>

        <Paper className={classes.statCard}>
          <Text size="xs" c="dimmed" fw={500}>
            Total Filtered
          </Text>
          <Text size="xl" fw={700} c="teal">
            {pagination.total}
          </Text>
          <Text size="xs" c="dimmed">
            Invoice sesuai filter aktif
          </Text>
        </Paper>
      </div>

      {/* Tabs Menu */}
      <Tabs
        value={activeTab}
        onChange={(tab) => {
          if (tab) navigateQuery({ status: tab, page: 1 });
        }}
        mb="md"
      >
        <Tabs.List>
          <Tabs.Tab value="all">Semua</Tabs.Tab>
          <Tabs.Tab
            value="kurasi"
            rightSection={
              pendingCount > 0 ? (
                <Badge size="xs" color="yellow" variant="filled">
                  {pendingCount}
                </Badge>
              ) : undefined
            }
          >
            Menunggu Kurasi
          </Tabs.Tab>
          <Tabs.Tab
            value="pending"
            rightSection={
              openCount > 0 ? (
                <Badge size="xs" color="blue" variant="filled">
                  {openCount}
                </Badge>
              ) : undefined
            }
          >
            Pending / Open
          </Tabs.Tab>
          <Tabs.Tab value="paid">Lunas</Tabs.Tab>
          <Tabs.Tab value="expired">Kadaluarsa</Tabs.Tab>
          <Tabs.Tab value="canceled">Dibatalkan</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {/* Header Controls */}
      <div className={classes.headerRow}>
        <Stack gap={2}>
          <Text className={classes.title}>
            {activeTab === "open" || activeTab === "pending"
              ? "Daftar Pesanan Pending / Open"
              : activeTab === "kurasi"
                ? "Daftar Bukti Menunggu Kurasi"
                : activeTab === "paid"
                  ? "Daftar Pesanan Lunas"
                  : activeTab === "expired"
                    ? "Daftar Pesanan Kadaluarsa"
                    : activeTab === "canceled"
                      ? "Daftar Pesanan Dibatalkan / Ditolak"
                      : "Seluruh Riwayat Invoice"}
          </Text>
          <Text className={classes.subtitle}>
            {activeTab === "open" || activeTab === "pending"
              ? "Pantau invoice yang baru dibuat atau sedang dalam proses pembayaran online / manual."
              : activeTab === "kurasi"
                ? "Verifikasi bukti transfer pengguna sebelum poin dikreditkan ke saldo akun."
                : activeTab === "paid"
                  ? "Riwayat invoice yang sudah berhasil diverifikasi dan dibayar."
                  : activeTab === "expired"
                    ? "Invoice yang sudah melewati batas waktu pembayaran (sesi berakhir)."
                    : activeTab === "canceled"
                      ? "Invoice yang dibatalkan oleh pelanggan atau ditolak oleh admin."
                      : "Daftar lengkap seluruh transaksi di sistem."}
          </Text>
        </Stack>

        <div className={classes.controls}>
          <form onSubmit={handleSearchSubmit}>
            <Group gap="xs">
              <TextInput
                size="xs"
                placeholder="Cari kode atau email..."
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                leftSection={<SearchIcon />}
                className={classes.searchInput}
              />
              <Button size="xs" variant="light" type="submit">
                Cari
              </Button>
            </Group>
          </form>

          <Select
            size="xs"
            w={160}
            value={`${currentParams?.sortBy ?? "createdAt"}-${currentParams?.sortOrder ?? "desc"}`}
            onChange={(val) => {
              if (!val) return;
              const [sortBy, sortOrder] = val.split("-");
              navigateQuery({ sortBy, sortOrder, page: 1 });
            }}
            data={[
              { value: "createdAt-desc", label: "Terbaru" },
              { value: "createdAt-asc", label: "Terlama" },
              { value: "amountIdr-desc", label: "Nominal Tertinggi" },
              { value: "amountIdr-asc", label: "Nominal Terendah" },
              { value: "points-desc", label: "Poin Tertinggi" },
            ]}
          />

          <Select
            size="xs"
            w={110}
            value={String(pagination.limit)}
            onChange={(val) => {
              if (val) navigateQuery({ limit: parseInt(val, 10), page: 1 });
            }}
            data={[
              { value: "10", label: "10 / hal" },
              { value: "20", label: "20 / hal" },
              { value: "50", label: "50 / hal" },
              { value: "100", label: "100 / hal" },
            ]}
          />

          <Button
            size="xs"
            variant="default"
            leftSection={<DownloadIcon />}
            onClick={exportCsv}
            disabled={allInvoices.length === 0}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <ErrorAlert message={error} />

      {successMessage && (
        <Paper p="xs" mb="sm" withBorder radius="sm">
          <Text size="xs" c="teal" fw={500}>
            {successMessage}
          </Text>
        </Paper>
      )}

      {allInvoices.length === 0 ? (
        <EmptyState minHeight={220}>
          {search
            ? `Tidak ada invoice yang cocok dengan pencarian "${search}".`
            : activeTab === "kurasi"
              ? "Tidak ada bukti menunggu kurasi saat ini."
              : activeTab === "pending" || activeTab === "open"
                ? "Tidak ada pesanan pending saat ini."
                : activeTab === "paid"
                  ? "Belum ada invoice lunas."
                  : activeTab === "expired"
                    ? "Tidak ada invoice kadaluarsa."
                    : activeTab === "canceled"
                      ? "Tidak ada invoice dibatalkan."
                      : "Belum ada riwayat invoice."}
        </EmptyState>
      ) : (
        <ResponsiveTable
          data={allInvoices}
          keyExtractor={(item) => item.invoiceId}
          renderHeader={() => (
            <Table.Tr className={classes.tableHeader}>
              <Table.Th>Kode Invoice & Pengguna</Table.Th>
              <Table.Th>Nominal & Poin</Table.Th>
              <Table.Th>Metode Pembayaran</Table.Th>
              <Table.Th>
                {activeTab === "kurasi" ? "Waktu Unggah" : "Waktu Dibuat / Sesi"}
              </Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th className={classes.actionCell}>Aksi</Table.Th>
            </Table.Tr>
          )}
          renderRow={(item) => {
            const isPaid = item.status === "paid";
            const isAwaiting = item.status === "awaiting_review";
            const isRejected = item.status === "rejected";
            const isCanceled = item.status === "canceled";
            const isExpired = item.status === "expired";
            const isUnpaid = item.status === "unpaid";

            const isMidtrans = item.paymentMethod === "midtrans";
            const hasGatewayExpiry = Boolean(item.gatewayExpiredAt);
            const isGatewayExpired =
              hasGatewayExpiry && new Date(item.gatewayExpiredAt!) < new Date();

            const isChecking = checkingInvoiceId === item.invoiceId;

            return (
              <Table.Tr key={item.invoiceId} className={classes.tableRow}>
                <Table.Td>
                  <div className={classes.codeCell}>
                    <span className={classes.uniqueCode}>{item.uniqueCode}</span>
                    <span className={classes.userEmail}>{item.email}</span>
                  </div>
                </Table.Td>

                <Table.Td>
                  <div className={classes.amountCell}>
                    <span className={classes.amountValue}>{formatIdr(item.amountIdr)}</span>
                    <span className={classes.pointsValue}>+{item.points} Poin</span>
                  </div>
                </Table.Td>

                <Table.Td>
                  <div className={classes.methodCell}>
                    <Group gap={4}>
                      <Badge
                        size="xs"
                        variant="light"
                        color={isMidtrans ? "blue" : "gray"}
                      >
                        {isMidtrans ? "Midtrans Snap" : "Manual Transfer"}
                      </Badge>
                    </Group>
                    {item.gatewayPaymentChannel && (
                      <Text size="xs" c="dimmed">
                        {item.gatewayPaymentChannel}
                      </Text>
                    )}
                  </div>
                </Table.Td>

                <Table.Td className={classes.dateCell} suppressHydrationWarning>
                  {activeTab === "kurasi" ? (
                    item.proofSubmittedAt ? formatDateId(item.proofSubmittedAt) : "-"
                  ) : (
                    <div>
                      <Text size="xs" suppressHydrationWarning>
                        {item.createdAt ? formatDateId(item.createdAt) : "-"}
                      </Text>
                      {isMidtrans && item.gatewayExpiredAt && isUnpaid && (
                        <Text
                          size="xs"
                          c={isGatewayExpired ? "red" : "dimmed"}
                          suppressHydrationWarning
                        >
                          {isGatewayExpired
                            ? "Sesi kedaluwarsa"
                            : `Sesi s/d: ${formatDateId(item.gatewayExpiredAt)}`}
                        </Text>
                      )}
                      {isPaid && item.paidAt && (
                        <Text size="xs" c="teal" suppressHydrationWarning>
                          Lunas: {formatDateId(item.paidAt)}
                        </Text>
                      )}
                    </div>
                  )}
                </Table.Td>

                <Table.Td>
                  <Badge
                    variant={isCanceled || isExpired ? "outline" : "light"}
                    color={
                      isPaid
                        ? "teal"
                        : isAwaiting
                          ? "yellow"
                          : isRejected
                            ? "red"
                            : isCanceled
                              ? "gray"
                              : isExpired
                                ? "orange"
                                : "blue"
                    }
                    size="sm"
                    radius="sm"
                  >
                    {item.statusLabel ||
                      (isPaid
                        ? "Lunas"
                        : isAwaiting
                          ? "Menunggu Kurasi"
                          : isRejected
                            ? "Ditolak"
                            : isCanceled
                              ? "Dibatalkan"
                              : isExpired
                                ? "Kedaluwarsa"
                                : "Open / Belum Bayar")}
                  </Badge>
                </Table.Td>

                <Table.Td className={classes.actionCell}>
                  <Group gap="xs" justify="flex-end">
                    {isAwaiting && (
                      <Button
                        size="xs"
                        variant="light"
                        color="blue"
                        onClick={() => void loadProof(item)}
                        loading={busy && previewItem?.invoiceId === item.invoiceId}
                      >
                        Bukti Bayar
                      </Button>
                    )}

                    {isUnpaid && isMidtrans && !isExpired && (
                      <Button
                        size="xs"
                        variant="default"
                        leftSection={isChecking ? undefined : <RefreshIcon />}
                        loading={isChecking}
                        disabled={busy}
                        onClick={() =>
                          void handleCheckGatewayStatus(item.invoiceId, item.uniqueCode)
                        }
                      >
                        Cek Gateway
                      </Button>
                    )}

                    {(isUnpaid || isAwaiting || isRejected) && !isExpired && (
                      <Button
                        size="xs"
                        variant="subtle"
                        color="red"
                        disabled={busy || isChecking}
                        onClick={() => {
                          setCancelingItem(item);
                          setCancelReason("");
                        }}
                      >
                        Batalkan
                      </Button>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          }}
          renderMobileCard={(item) => {
            const isPaid = item.status === "paid";
            const isAwaiting = item.status === "awaiting_review";
            const isRejected = item.status === "rejected";
            const isCanceled = item.status === "canceled";
            const isExpired = item.status === "expired";
            const isUnpaid = item.status === "unpaid";

            const isMidtrans = item.paymentMethod === "midtrans";
            const isChecking = checkingInvoiceId === item.invoiceId;

            return (
              <div
                key={item.invoiceId}
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid var(--mantine-color-default-border)",
                  borderRadius: 12,
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <div>
                    <Text fw={700} size="sm" c="blue.4">
                      {item.uniqueCode}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {item.email}
                    </Text>
                  </div>
                  <Badge
                    variant={isCanceled || isExpired ? "outline" : "light"}
                    color={
                      isPaid
                        ? "teal"
                        : isAwaiting
                          ? "yellow"
                          : isRejected
                            ? "red"
                            : isCanceled
                              ? "gray"
                              : isExpired
                                ? "orange"
                                : "blue"
                    }
                    size="sm"
                    radius="sm"
                  >
                    {item.statusLabel ||
                      (isPaid
                        ? "Lunas"
                        : isAwaiting
                          ? "Menunggu Kurasi"
                          : isRejected
                            ? "Ditolak"
                            : isCanceled
                              ? "Dibatalkan"
                              : isExpired
                                ? "Kedaluwarsa"
                                : "Open / Belum Bayar")}
                  </Badge>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <div>
                    <Text size="xs" c="dimmed">
                      Nominal & Poin
                    </Text>
                    <Text size="sm" fw={700}>
                      {formatIdr(item.amountIdr)}{" "}
                      <Text span size="xs" c="teal.4" fw={600}>
                        (+{item.points} Poin)
                      </Text>
                    </Text>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <Badge size="xs" variant="light" color={isMidtrans ? "blue" : "gray"}>
                      {isMidtrans ? "Midtrans Snap" : "Manual Transfer"}
                    </Badge>
                    <Text size="xs" c="dimmed" suppressHydrationWarning mt={2}>
                      {activeTab === "kurasi" && item.proofSubmittedAt
                        ? formatDateId(item.proofSubmittedAt)
                        : item.createdAt
                          ? formatDateId(item.createdAt)
                          : "-"}
                    </Text>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {isAwaiting && (
                    <Button
                      size="xs"
                      variant="light"
                      color="blue"
                      onClick={() => void loadProof(item)}
                      loading={busy && previewItem?.invoiceId === item.invoiceId}
                    >
                      Bukti Bayar
                    </Button>
                  )}

                  {isUnpaid && isMidtrans && !isExpired && (
                    <Button
                      size="xs"
                      variant="default"
                      leftSection={isChecking ? undefined : <RefreshIcon />}
                      loading={isChecking}
                      disabled={busy}
                      onClick={() =>
                        void handleCheckGatewayStatus(item.invoiceId, item.uniqueCode)
                      }
                    >
                      Cek Gateway
                    </Button>
                  )}

                  {(isUnpaid || isAwaiting || isRejected) && !isExpired && (
                    <Button
                      size="xs"
                      variant="subtle"
                      color="red"
                      disabled={busy || isChecking}
                      onClick={() => {
                        setCancelingItem(item);
                        setCancelReason("");
                      }}
                    >
                      Batalkan
                    </Button>
                  )}
                </div>
              </div>
            );
          }}
        />
      )}

      {/* Pagination and Summary Footer */}
      <div className={classes.summaryFooter}>
        <Text size="xs" c="dimmed">
          Menampilkan <strong>{startItem}–{endItem}</strong> dari{" "}
          <strong>{pagination.total}</strong> invoice (Halaman {pagination.page} dari{" "}
          {pagination.totalPages}).
        </Text>

        {pagination.totalPages > 1 && (
          <Pagination
            size="sm"
            total={pagination.totalPages}
            value={pagination.page}
            onChange={(newPage) => navigateQuery({ page: newPage })}
          />
        )}
      </div>

      {/* Modal Bukti Bayar & Kurasi */}
      <Modal
        opened={Boolean(previewItem && previewUrl)}
        onClose={() => {
          if (!busy) {
            setPreviewItem(null);
            setPreviewUrl(null);
            setPreviewType(null);
            setShowRejectForm(false);
            setRejectReason("");
          }
        }}
        title={`Bukti Transfer: ${previewItem?.uniqueCode ?? ""}`}
        size="lg"
        centered
      >
        <Stack gap="sm">
          <Paper p="sm" withBorder radius="md">
            <Group justify="space-between" align="center">
              <div>
                <Text size="xs" c="dimmed">
                  Email Pengguna
                </Text>
                <Text size="sm" fw={600}>
                  {previewItem?.email}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Nominal Pembayaran
                </Text>
                <Text size="sm" fw={600} c="blue">
                  {previewItem ? formatIdr(previewItem.amountIdr) : ""}
                </Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Poin Didapat
                </Text>
                <Text size="sm" fw={600} c="teal">
                  +{previewItem?.points} Poin
                </Text>
              </div>
            </Group>
          </Paper>

          {previewUrl ? (
            <div>
              <AppLink href={previewUrl} external>
                Buka file bukti di tab baru ↗
              </AppLink>
              {previewType?.startsWith("image/") ? (
                <Image
                  src={previewUrl}
                  alt="Bukti transfer"
                  className={classes.previewImage}
                />
              ) : (
                <Paper p="md" mt="sm" withBorder>
                  <Text size="sm">
                    File dokumen bukti ({previewType ?? "dokumen"}). Klik link di atas untuk
                    membuka.
                  </Text>
                </Paper>
              )}
            </div>
          ) : null}

          {showRejectForm ? (
            <Stack gap="xs" mt="sm">
              <Divider label="Form Penolakan Bukti" labelPosition="center" />
              <Textarea
                label="Alasan Penolakan (Opsional)"
                placeholder="Contoh: Nominal transfer tidak sesuai, atau bukti mutasi tidak terbaca."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.currentTarget.value)}
                minRows={2}
                disabled={busy}
              />
              <Group justify="flex-end" gap="xs">
                <Button
                  variant="default"
                  size="xs"
                  onClick={() => setShowRejectForm(false)}
                  disabled={busy}
                >
                  Batal Tolak
                </Button>
                <Button
                  color="red"
                  size="xs"
                  onClick={() => void handleReject()}
                  loading={busy}
                >
                  Konfirmasi Tolak Pembayaran
                </Button>
              </Group>
            </Stack>
          ) : null}

          <Group justify="space-between" mt="md">
            <Button
              variant="default"
              onClick={() => {
                setPreviewItem(null);
                setPreviewUrl(null);
                setPreviewType(null);
                setShowRejectForm(false);
                setRejectReason("");
              }}
              disabled={busy}
            >
              Tutup
            </Button>
            {previewItem && !showRejectForm ? (
              <Group gap="xs">
                <Button
                  color="red"
                  variant="light"
                  onClick={() => setShowRejectForm(true)}
                  disabled={busy}
                >
                  Tolak
                </Button>
                <Button
                  color="teal"
                  onClick={() => {
                    const it = previewItem;
                    setApprovingItem(it);
                  }}
                  disabled={busy}
                >
                  Terima Pembayaran
                </Button>
              </Group>
            ) : null}
          </Group>
        </Stack>
      </Modal>

      {/* Modal Konfirmasi Terima */}
      <Modal
        opened={Boolean(approvingItem)}
        onClose={() => !busy && setApprovingItem(null)}
        title="Konfirmasi Terima Pembayaran"
        centered
      >
        <Stack gap="sm">
          <Text size="sm">
            Apakah Anda yakin ingin menyetujui pembayaran untuk invoice{" "}
            <strong>{approvingItem?.uniqueCode}</strong> ({approvingItem?.email})?
          </Text>
          <Text size="sm" c="teal">
            Sebanyak <strong>+{approvingItem?.points} Poin</strong> akan langsung dikreditkan ke
            akun pengguna.
          </Text>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setApprovingItem(null)} disabled={busy}>
              Batal
            </Button>
            <Button color="teal" onClick={() => void handleApprove()} loading={busy}>
              Ya, Setujui & Tambah Poin
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal Konfirmasi Batal Admin */}
      <Modal
        opened={Boolean(cancelingItem)}
        onClose={() => {
          if (!busy) {
            setCancelingItem(null);
            setCancelReason("");
          }
        }}
        title={`Batalkan Pesanan: ${cancelingItem?.uniqueCode ?? ""}`}
        centered
      >
        <Stack gap="sm">
          <Text size="sm">
            Apakah Anda yakin ingin membatalkan pesanan invoice{" "}
            <strong>{cancelingItem?.uniqueCode}</strong> milik{" "}
            <strong>{cancelingItem?.email}</strong> senilai{" "}
            <strong>{cancelingItem ? formatIdr(cancelingItem.amountIdr) : ""}</strong> (+
            {cancelingItem?.points} Poin)?
          </Text>
          <Text size="xs" c="dimmed">
            Setelah dibatalkan, tagihan ini tidak dapat dibayar lagi oleh pelanggan.
          </Text>
          <Textarea
            label="Alasan Pembatalan (Opsional)"
            placeholder="Contoh: Permintaan pelanggan atau pesanan kedaluwarsa."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.currentTarget.value)}
            minRows={2}
            disabled={busy}
          />
          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => {
                setCancelingItem(null);
                setCancelReason("");
              }}
              disabled={busy}
            >
              Kembali
            </Button>
            <Button
              color="red"
              onClick={() => void handleCancelByAdmin()}
              loading={busy}
            >
              Ya, Batalkan Invoice
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal QR Info Sandbox */}
      <Modal
        opened={Boolean(qrModalInfo)}
        onClose={() => {
          setQrModalInfo(null);
          setCopied(false);
        }}
        title={`Informasi QRIS Sandbox: ${qrModalInfo?.code ?? ""}`}
        size="lg"
        centered
      >
        <Stack gap="sm">
          <Text size="sm">
            Gunakan string QRIS berikut untuk simulator sandbox Midtrans atau aplikasi scanner
            sandbox:
          </Text>

          {qrModalInfo?.qrString && (
            <Stack gap="xs">
              <Textarea
                label="Raw QRIS String"
                value={qrModalInfo.qrString}
                readOnly
                autosize
                minRows={3}
                maxRows={6}
              />
              <Group justify="space-between" align="center">
                <Button
                  size="xs"
                  variant="light"
                  color={copied ? "teal" : "blue"}
                  onClick={() => {
                    if (qrModalInfo?.qrString) {
                      void navigator.clipboard.writeText(qrModalInfo.qrString);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2500);
                    }
                  }}
                >
                  {copied ? "Berhasil Disalin!" : "Salin QRIS String"}
                </Button>
                <AppLink
                  href="https://simulator.sandbox.midtrans.com/qris/index"
                  external
                >
                  Buka Midtrans QRIS Simulator ↗
                </AppLink>
              </Group>
            </Stack>
          )}

          {qrModalInfo?.qrUrl && (
            <Stack gap="xs" mt="xs">
              <Text size="xs" fw={500} c="dimmed">
                URL QR Code:
              </Text>
              <AppLink href={qrModalInfo.qrUrl} external>
                {qrModalInfo.qrUrl} ↗
              </AppLink>
            </Stack>
          )}

          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => {
                setQrModalInfo(null);
                setCopied(false);
              }}
            >
              Tutup
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
