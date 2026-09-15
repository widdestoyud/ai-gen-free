"use client";

import {
  Badge,
  Button,
  Card,
  FileInput,
  Group,
  Modal,
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
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
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
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [gatewayEnabled, setGatewayEnabled] = useState(false);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

  // Upload proof modal state
  const [uploadInvoice, setUploadInvoice] = useState<Invoice | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Cancel confirmation modal state
  const [cancelingInvoice, setCancelingInvoice] = useState<Invoice | null>(null);

  const {
    payAndRedirect,
    getPaymentMethods,
    error: paymentError,
    clearError: clearPaymentError,
  } = usePayment();

  // Check if online payment gateway is enabled
  useEffect(() => {
    getPaymentMethods().then((methods) => {
      const online = methods.find((m) => m.id === "midtrans" || m.id === "doku");
      setGatewayEnabled(online?.enabled ?? false);
    });
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
    setBusy(true);
    const result = await requestJson("/api/invoices", {
      method: "POST",
      body: JSON.stringify({ packageId }),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
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
    async (invoiceId: string) => {
      setError("");
      clearPaymentError();
      setPayingInvoiceId(invoiceId);
      setBusy(true);

      try {
        await payAndRedirect(invoiceId);
      } finally {
        setBusy(false);
        setPayingInvoiceId(null);
      }
    },
    [payAndRedirect, clearPaymentError],
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
      <Text className={classes.sectionTitle}>Pilih Paket Poin</Text>

      {gatewayEnabled ? (
        <Text className={classes.sectionSubtitle}>
          Pilih paket poin di bawah ini, lalu selesaikan pembayaran instan via Midtrans (Virtual Account, QRIS,
          GoPay, ShopeePay). Poin otomatis masuk setelah pembayaran berhasil.
        </Text>
      ) : (
        <Text className={classes.sectionSubtitle}>
          Pilih paket, bayar transfer/QRIS sesuai invoice yang diterbitkan, lalu unggah bukti transfer
          pada tabel invoice di bawah. Poin akan masuk setelah dikurasi oleh admin.
        </Text>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md" className={classes.packagesGrid}>
        {props.packages.map((p) => (
          <Card key={p.id} withBorder padding="lg" radius="md" className={classes.packageCard}>
            <Text fw={600} size="lg">
              {p.label}
            </Text>
            <Text size="xl" fw={700} c="blue" mt="xs">
              {formatIdr(p.amountIdr)}
            </Text>
            <Text size="sm" c="dimmed" mb="md">
              Dapatkan <strong>{p.points} Poin</strong> Generate
            </Text>
            <Button
              type="button"
              variant="filled"
              color="blue"
              fullWidth
              disabled={busy}
              onClick={() => void buy(p.id)}
            >
              Pesan Paket
            </Button>
          </Card>
        ))}
      </SimpleGrid>

      <ErrorAlert message={displayError} />

      {/* Tabel Riwayat Invoice */}
      <Paper className={classes.tableContainer}>
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
          <Table verticalSpacing="sm" horizontalSpacing="md">
            <Table.Thead className={classes.tableHeader}>
              <Table.Tr>
                <Table.Th>Kode Invoice</Table.Th>
                <Table.Th>Nominal & Poin</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Tanggal Dibuat</Table.Th>
                <Table.Th className={classes.actionCell}>Aksi / Pembayaran</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredInvoices.map((inv) => {
                const isCanceled = inv.status === "canceled";
                const isPaid = inv.status === "paid";
                const isAwaiting = inv.status === "awaiting_review";
                const isRejected = inv.status === "rejected";
                const isUnpaid = inv.status === "unpaid";
                const canPay = isUnpaid || isRejected;
                const canCancel = isUnpaid || isRejected || isAwaiting;

                const isPaying = payingInvoiceId === inv.id;
                const hasGatewaySession = inv.gateway?.paymentUrl && inv.gateway?.expiredAt;
                const gatewayExpired = hasGatewaySession && new Date(inv.gateway!.expiredAt!) < new Date();

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
                      <Group gap="xs">
                        <Badge
                          color={
                            isPaid
                              ? "teal"
                              : isAwaiting
                                ? "yellow"
                                : isRejected
                                  ? "red"
                                  : isCanceled
                                    ? "gray"
                                    : "blue"
                          }
                          size="sm"
                          radius="sm"
                          variant={isCanceled ? "outline" : "light"}
                        >
                          {inv.statusLabel}
                        </Badge>
                        {isRejected && inv.reviewNote ? (
                          <Tooltip label={`Alasan tolak: ${inv.reviewNote}`} withArrow>
                            <Text size="xs" c="red" td="underline" style={{ cursor: "pointer" }}>
                              Lihat alasan
                            </Text>
                          </Tooltip>
                        ) : null}
                      </Group>
                    </Table.Td>

                    <Table.Td className={classes.dateCell}>
                      {inv.createdAt ? formatDateId(inv.createdAt) : "-"}
                      {inv.paidAt && isPaid ? (
                        <Text size="xs" c="teal">
                          Lunas: {formatDateId(inv.paidAt)}
                          {inv.gateway?.paymentChannel ? ` (${inv.gateway.paymentChannel})` : ""}
                        </Text>
                      ) : null}
                    </Table.Td>

                    <Table.Td className={classes.actionCell}>
                      {canPay ? (
                        <Group gap="xs" justify="flex-end">
                          {gatewayEnabled ? (
                            <Button
                              size="xs"
                              variant="filled"
                              color="blue"
                              disabled={busy || isPaying}
                              leftSection={isPaying ? <Loader size="xs" /> : null}
                              onClick={() => void handlePayGateway(inv.id)}
                            >
                              {isPaying
                                ? "Memproses..."
                                : hasGatewaySession && !gatewayExpired
                                  ? "Lanjut Bayar Online"
                                  : "Bayar Online"}
                            </Button>
                          ) : null}

                          <Button
                            size="xs"
                            variant="light"
                            color="gray"
                            onClick={() => {
                              setUploadInvoice(inv);
                              setSelectedFile(null);
                            }}
                            disabled={busy}
                          >
                            Unggah Bukti
                          </Button>

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
                        <Group gap="xs" justify="flex-end">
                          <Text size="xs" c="dimmed">
                            Menunggu kurasi admin
                          </Text>
                          <Button
                            size="xs"
                            variant="subtle"
                            color="red"
                            disabled={busy}
                            onClick={() => setCancelingInvoice(inv)}
                          >
                            Batalkan
                          </Button>
                        </Group>
                      ) : isPaid ? (
                        <Text size="xs" c="teal">
                          Poin sudah ditambahkan
                        </Text>
                      ) : isCanceled ? (
                        <Text size="xs" c="dimmed">
                          Pesanan dibatalkan
                        </Text>
                      ) : null}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Modal Upload Bukti Transfer */}
      <Modal
        opened={Boolean(uploadInvoice)}
        onClose={() => {
          if (!busy) {
            setUploadInvoice(null);
            setSelectedFile(null);
          }
        }}
        title={`Unggah Bukti Transfer: ${uploadInvoice?.uniqueCode ?? ""}`}
        centered
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Nominal Tagihan: <strong>{uploadInvoice ? formatIdr(uploadInvoice.amountIdr) : ""}</strong> (
            +{uploadInvoice?.points} Poin)
          </Text>

          {uploadInvoice?.instructions ? (
            <Paper p="xs" withBorder>
              <Text size="xs" c="dimmed">
                {uploadInvoice.instructions}
              </Text>
            </Paper>
          ) : null}

          <FileInput
            label="Pilih berkas bukti transfer"
            placeholder="Pilih file gambar atau PDF..."
            accept="image/jpeg,image/png,image/webp,application/pdf"
            value={selectedFile}
            onChange={setSelectedFile}
            disabled={busy}
            required
          />

          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => {
                setUploadInvoice(null);
                setSelectedFile(null);
              }}
              disabled={busy}
            >
              Batal
            </Button>
            <Button
              color="blue"
              onClick={() => void handleUploadProof()}
              disabled={!selectedFile || busy}
              loading={busy}
            >
              Kirim Bukti
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
        title="Konfirmasi Pembatalan Pesanan"
        centered
      >
        <Stack gap="sm">
          <Text size="sm">
            Apakah Anda yakin ingin membatalkan tagihan invoice{" "}
            <strong>{cancelingInvoice?.uniqueCode}</strong> senilai{" "}
            <strong>{cancelingInvoice ? formatIdr(cancelingInvoice.amountIdr) : ""}</strong> (+
            {cancelingInvoice?.points} Poin)?
          </Text>
          <Text size="xs" c="dimmed">
            Setelah dibatalkan, tagihan ini tidak dapat dibayar lagi dan Anda dapat membuat pesanan baru kapan saja.
          </Text>
          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => setCancelingInvoice(null)}
              disabled={busy}
            >
              Kembali
            </Button>
            <Button
              color="red"
              onClick={() => void handleConfirmCancel()}
              loading={busy}
            >
              Ya, Batalkan Pesanan
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
