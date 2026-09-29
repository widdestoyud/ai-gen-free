"use client";

import {
  Badge,
  Button,
  Card,
  CopyButton,
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
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [gatewayEnabled, setGatewayEnabled] = useState(false);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

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
  } = usePayment();

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

    // Jika online gateway aktif, inisiasi sesi pembayaran dan redirect langsung
    if (gatewayEnabled) {
      const payRes = await initiatePayment(result.data.id);
      if (payRes?.paymentUrl) {
        window.location.href = payRes.paymentUrl;
        return;
      }
    }

    // Direct Payment (Manual Transfer / Upload Bukti): langsung buka modal unggah bukti
    const selectedPkg = props.packages.find((p) => p.id === packageId);
    setUploadInvoice({
      id: result.data.id,
      uniqueCode: result.data.uniqueCode,
      amountIdr: selectedPkg?.amountIdr ?? 0,
      points: selectedPkg?.points ?? 0,
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
              buttonLabel={`Pesan ${plan.name}`}
              disabled={busy}
              onSelect={(id) => void buy(id)}
            />
          );
        })}
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
                const hasGatewaySession = inv.gateway?.paymentUrl && inv.gateway?.expiredAt;
                const gatewayExpired = hasGatewaySession && new Date(inv.gateway!.expiredAt!) < new Date();
                const isExpired = inv.status === "expired" || gatewayExpired;
                const isUnpaid = inv.status === "unpaid" && !isExpired;
                const canPay = (isUnpaid || isRejected) && !isExpired;
                const canCancel = (isUnpaid || isRejected || isAwaiting) && !isExpired;

                const isPaying = payingInvoiceId === inv.id;

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
                        {isRejected && inv.reviewNote ? (
                          <Tooltip label={`Alasan tolak: ${inv.reviewNote}`} withArrow>
                            <Text size="xs" c="red" td="underline" className={classes.pointerText}>
                              Lihat alasan
                            </Text>
                          </Tooltip>
                        ) : null}
                      </Group>
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
                          {gatewayEnabled ? (
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
                      ) : isExpired ? (
                        <Text size="xs" c="dimmed">
                          Pesanan kedaluwarsa
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
              Rincian Pembayaran & Bukti Transfer
            </Text>
            {uploadInvoice?.uniqueCode && (
              <Badge variant="light" color="blue" size="sm">
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

          {/* Bank Destination & Account Details */}
          <div className={classes.accountCard}>
            <Group justify="space-between" align="center" mb={4}>
              <Text size="xs" fw={700} c="blue.4" tt="uppercase">
                Rekening Tujuan Pembayaran
              </Text>
              <Badge size="xs" color="blue" variant="light">
                Bank Transfer
              </Badge>
            </Group>

            <div className={classes.accountNumberBox}>
              <div>
                <Text size="xs" c="dimmed">
                  Bank BCA — a.n PT Satulabs Kreasi Indonesia
                </Text>
                <Text className={classes.accountNumber}>
                  8831 2345 6789
                </Text>
              </div>
              <CopyButton value="883123456789" timeout={2000}>
                {({ copied, copy }) => (
                  <Button
                    size="xs"
                    variant={copied ? "filled" : "light"}
                    color={copied ? "teal" : "blue"}
                    onClick={copy}
                  >
                    {copied ? "Tersalin ✓" : "Salin No. Rek 📋"}
                  </Button>
                )}
              </CopyButton>
            </div>
          </div>

          {/* Step-by-Step Instructions */}
          <div className={classes.instructionBox}>
            <Stack gap="xs">
              <div className={classes.instructionStep}>
                <div className={classes.stepNumber}>1</div>
                <Text size="xs" c="gray.3">
                  Transfer sebesar <strong>{uploadInvoice ? formatIdr(uploadInvoice.amountIdr) : ""}</strong> ke rekening BCA di atas.
                </Text>
              </div>
              <div className={classes.instructionStep}>
                <div className={classes.stepNumber}>2</div>
                <Text size="xs" c="gray.3">
                  Simpan struk atau tangkapan layar (screenshot) bukti transfer m-Banking / ATM Anda.
                </Text>
              </div>
              <div className={classes.instructionStep}>
                <div className={classes.stepNumber}>3</div>
                <Text size="xs" c="gray.3">
                  Unggah berkas bukti transfer di bawah ini, lalu klik <strong>Kirim Bukti Pembayaran</strong>.
                </Text>
              </div>
            </Stack>
          </div>

          {/* File Input */}
          <FileInput
            label="Unggah File Bukti Pembayaran"
            description="Format yang didukung: JPG, PNG, WebP, atau PDF (maks. 5MB)"
            placeholder="Pilih foto / berkas bukti transfer..."
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
