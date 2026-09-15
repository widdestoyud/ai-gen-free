"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Divider,
  Group,
  Image,
  Modal,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import { AppLink } from "@/components/app-link";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { requestJson } from "@/lib/api";
import { formatDateId, formatIdr } from "@/lib/format";
import type { InboxItem } from "@/app/admin/page";
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

export function AdminInbox({ items }: { items: InboxItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Modal Bukti Bayar & Kurasi state
  const [previewItem, setPreviewItem] = useState<InboxItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Modal Konfirmasi Terima
  const [approvingItem, setApprovingItem] = useState<InboxItem | null>(null);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.uniqueCode.toLowerCase().includes(q) ||
        item.email.toLowerCase().includes(q) ||
        item.invoiceId.toLowerCase().includes(q),
    );
  }, [items, search]);

  async function loadProof(item: InboxItem) {
    setError("");
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
    router.refresh();
  }

  async function handleReject() {
    if (!previewItem) return;
    setBusy(true);
    setError("");
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
    router.refresh();
  }

  function exportCsv() {
    if (filteredItems.length === 0) return;
    const headers = ["Invoice ID", "Kode Unik", "Email", "Nominal (IDR)", "Poin", "Waktu Submit", "Status"];
    const rows = filteredItems.map((item) => [
      `"${item.invoiceId}"`,
      `"${item.uniqueCode}"`,
      `"${item.email}"`,
      `"${item.amountIdr}"`,
      `"${item.points}"`,
      `"${item.proofSubmittedAt ? formatDateId(item.proofSubmittedAt) : "-"}"`,
      `"${item.status}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `kurasi-pembayaran-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <Paper className={classes.inboxContainer}>
      <div className={classes.headerRow}>
        <Stack gap={2}>
          <Text className={classes.title}>Daftar Bukti Menunggu Kurasi</Text>
          <Text className={classes.subtitle}>
            Verifikasi bukti transfer pengguna sebelum poin dikreditkan ke saldo akun.
          </Text>
        </Stack>

        <div className={classes.controls}>
          <TextInput
            size="xs"
            placeholder="Cari kode invoice atau email..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            leftSection={<SearchIcon />}
            className={classes.searchInput}
          />
          <Button
            size="xs"
            variant="default"
            leftSection={<DownloadIcon />}
            onClick={exportCsv}
            disabled={filteredItems.length === 0}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <ErrorAlert message={error} />

      {filteredItems.length === 0 ? (
        <EmptyState minHeight={220}>
          {search
            ? `Tidak ada bukti pembayaran yang cocok dengan pencarian "${search}".`
            : "Tidak ada bukti menunggu kurasi saat ini."}
        </EmptyState>
      ) : (
        <Table verticalSpacing="sm" horizontalSpacing="md">
          <Table.Thead className={classes.tableHeader}>
            <Table.Tr>
              <Table.Th>Kode Invoice & Pengguna</Table.Th>
              <Table.Th>Nominal & Poin</Table.Th>
              <Table.Th>Waktu Unggah</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th className={classes.actionCell}>Aksi</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredItems.map((item) => (
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

                <Table.Td className={classes.dateCell}>
                  {item.proofSubmittedAt ? formatDateId(item.proofSubmittedAt) : "-"}
                </Table.Td>

                <Table.Td>
                  <Badge variant="light" color="yellow" size="sm" radius="sm">
                    Menunggu Kurasi
                  </Badge>
                </Table.Td>

                <Table.Td className={classes.actionCell}>
                  <Button
                    size="xs"
                    variant="light"
                    color="blue"
                    onClick={() => void loadProof(item)}
                    loading={busy && previewItem?.invoiceId === item.invoiceId}
                  >
                    Bukti Bayar
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <div className={classes.summaryFooter}>
        <Text size="xs" c="dimmed">
          Total <strong>{filteredItems.length}</strong> bukti pembayaran dalam antrean kurasi.
        </Text>
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
                    File dokumen bukti ({previewType ?? "dokumen"}). Klik link di atas untuk membuka.
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
            Sebanyak <strong>+{approvingItem?.points} Poin</strong> akan langsung dikreditkan ke akun pengguna.
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
    </Paper>
  );
}
