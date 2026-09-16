"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Paper,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { ErrorAlert } from "@/components/error-alert";
import { requestJson } from "@/lib/api";
import { formatIdr } from "@/lib/format";
import type { AdminPackage } from "../types";
import classes from "./packages-list.module.css";

function PlusIcon() {
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
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
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

export function AdminPackagesList({ packages }: { packages: AdminPackage[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // Modal Form (Create / Edit) state
  const [formOpen, setFormOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<AdminPackage | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [amountIdr, setAmountIdr] = useState<number | string>(50000);
  const [originalAmountIdr, setOriginalAmountIdr] = useState<number | string>("");
  const [points, setPoints] = useState<number | string>(500);
  const [badgeText, setBadgeText] = useState("");
  const [sortOrder, setSortOrder] = useState<number | string>(1);
  const [active, setActive] = useState(true);

  // Modal Delete state
  const [deletingPackage, setDeletingPackage] = useState<AdminPackage | null>(null);

  const filteredPackages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return packages;
    return packages.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.badgeText && p.badgeText.toLowerCase().includes(q)),
    );
  }, [packages, search]);

  const openCreateModal = () => {
    setError("");
    setEditingPackage(null);
    setName("");
    setDescription("");
    setAmountIdr(50000);
    setOriginalAmountIdr("");
    setPoints(500);
    setBadgeText("");
    setSortOrder(packages.length + 1);
    setActive(true);
    setFormOpen(true);
  };

  const openEditModal = (pkg: AdminPackage) => {
    setError("");
    setEditingPackage(pkg);
    setName(pkg.name);
    setDescription(pkg.description ?? "");
    setAmountIdr(pkg.amountIdr);
    setOriginalAmountIdr(pkg.originalAmountIdr ?? "");
    setPoints(pkg.points);
    setBadgeText(pkg.badgeText ?? "");
    setSortOrder(pkg.sortOrder);
    setActive(pkg.active);
    setFormOpen(true);
  };

  const handleSubmitForm = async () => {
    if (!name.trim()) {
      setError("Nama paket wajib diisi");
      return;
    }
    const amount = Number(amountIdr);
    if (Number.isNaN(amount) || amount <= 0) {
      setError("Harga paket harus lebih dari 0");
      return;
    }
    const pts = Number(points);
    if (Number.isNaN(pts) || pts <= 0) {
      setError("Poin yang didapat harus lebih dari 0");
      return;
    }

    const origAmount =
      originalAmountIdr !== "" && !Number.isNaN(Number(originalAmountIdr))
        ? Number(originalAmountIdr)
        : null;

    setBusy(true);
    setError("");
    setSuccessMessage("");

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      amountIdr: amount,
      originalAmountIdr: origAmount && origAmount > 0 ? origAmount : undefined,
      points: pts,
      badgeText: badgeText.trim() || undefined,
      sortOrder: Number(sortOrder) || 0,
      active,
    };

    if (editingPackage) {
      const result = await requestJson(`/api/admin/packages/${editingPackage.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setBusy(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccessMessage(`Paket "${name}" berhasil diperbarui.`);
    } else {
      const result = await requestJson("/api/admin/packages", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setBusy(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccessMessage(`Paket "${name}" berhasil dibuat.`);
    }

    setFormOpen(false);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!deletingPackage) return;
    setBusy(true);
    setError("");
    setSuccessMessage("");

    const result = await requestJson(`/api/admin/packages/${deletingPackage.id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    setSuccessMessage(`Paket "${deletingPackage.name}" berhasil dihapus.`);
    setDeletingPackage(null);
    router.refresh();
  };

  const handleToggleActive = async (pkg: AdminPackage) => {
    setBusy(true);
    setError("");
    setSuccessMessage("");

    const result = await requestJson(`/api/admin/packages/${pkg.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !pkg.active }),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    setSuccessMessage(
      `Paket "${pkg.name}" kini ${!pkg.active ? "aktif" : "nonaktif"}.`,
    );
    router.refresh();
  };

  return (
    <div className={classes.container}>
      <div className={classes.headerRow}>
        <Stack gap={2}>
          <Text className={classes.title}>Daftar Paket Topup Poin</Text>
          <Text className={classes.subtitle}>
            Kelola nama paket, nominal harga, harga coret promosi, dan kuota poin yang ditawarkan ke pelanggan.
          </Text>
        </Stack>

        <div className={classes.controls}>
          <TextInput
            size="xs"
            placeholder="Cari nama paket..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            leftSection={<SearchIcon />}
          />
          <Button
            size="xs"
            color="blue"
            leftSection={<PlusIcon />}
            onClick={openCreateModal}
          >
            Tambah Paket
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

      {filteredPackages.length === 0 ? (
        <EmptyState minHeight={200}>
          {search
            ? `Tidak ada paket yang cocok dengan pencarian "${search}".`
            : "Belum ada paket topup. Klik 'Tambah Paket' untuk membuat paket baru."}
        </EmptyState>
      ) : (
        <Table verticalSpacing="sm" horizontalSpacing="md">
          <Table.Thead className={classes.tableHeader}>
            <Table.Tr>
              <Table.Th>Urutan</Table.Th>
              <Table.Th>Nama Paket & Deskripsi</Table.Th>
              <Table.Th>Harga / Promo Coret</Table.Th>
              <Table.Th>Poin Didapat</Table.Th>
              <Table.Th>Badge Promosi</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th className={classes.actionCell}>Aksi</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredPackages.map((pkg) => {
              const hasDiscount = Boolean(
                pkg.originalAmountIdr && pkg.originalAmountIdr > pkg.amountIdr,
              );
              return (
                <Table.Tr key={pkg.id} className={classes.tableRow}>
                  <Table.Td>
                    <Badge variant="outline" size="sm" color="gray">
                      #{pkg.sortOrder}
                    </Badge>
                  </Table.Td>

                  <Table.Td>
                    <div className={classes.nameCell}>
                      <span className={classes.packageName}>{pkg.name}</span>
                      {pkg.description ? (
                        <span className={classes.packageDesc}>{pkg.description}</span>
                      ) : null}
                    </div>
                  </Table.Td>

                  <Table.Td>
                    <div className={classes.amountCell}>
                      <span className={classes.priceValue}>
                        {formatIdr(pkg.amountIdr)}
                      </span>
                      {hasDiscount ? (
                        <span className={classes.strikethroughPrice}>
                          {formatIdr(pkg.originalAmountIdr!)}
                        </span>
                      ) : null}
                    </div>
                  </Table.Td>

                  <Table.Td>
                    <span className={classes.pointsValue}>
                      +{pkg.points.toLocaleString("id-ID")} Poin
                    </span>
                  </Table.Td>

                  <Table.Td>
                    {pkg.badgeText ? (
                      <Badge color="red" variant="filled" size="xs">
                        {pkg.badgeText}
                      </Badge>
                    ) : (
                      <Text size="xs" c="dimmed">
                        -
                      </Text>
                    )}
                  </Table.Td>

                  <Table.Td>
                    <Switch
                      size="sm"
                      checked={pkg.active}
                      disabled={busy}
                      onChange={() => void handleToggleActive(pkg)}
                      label={
                        <Badge
                          size="xs"
                          variant="light"
                          color={pkg.active ? "teal" : "gray"}
                        >
                          {pkg.active ? "Aktif" : "Nonaktif"}
                        </Badge>
                      }
                    />
                  </Table.Td>

                  <Table.Td className={classes.actionCell}>
                    <Group gap="xs" justify="flex-end">
                      <Button
                        size="xs"
                        variant="light"
                        color="blue"
                        onClick={() => openEditModal(pkg)}
                        disabled={busy}
                      >
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        variant="subtle"
                        color="red"
                        onClick={() => setDeletingPackage(pkg)}
                        disabled={busy}
                      >
                        Hapus
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      )}

      <div className={classes.summaryFooter}>
        <Text size="xs" c="dimmed">
          Total <strong>{filteredPackages.length}</strong> paket terdaftar dalam katalog.
        </Text>
      </div>

      {/* Modal Create / Edit Package */}
      <Modal
        opened={formOpen}
        onClose={() => !busy && setFormOpen(false)}
        title={editingPackage ? `Edit Paket: ${editingPackage.name}` : "Tambah Paket Topup Baru"}
        size="md"
        centered
      >
        <Stack gap="sm">
          <TextInput
            label="Nama Paket"
            placeholder="Contoh: Paket Populer 500 Poin"
            required
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            disabled={busy}
          />

          <Textarea
            label="Deskripsi Paket (Opsional)"
            placeholder="Contoh: Cocok untuk kebutuhan generate harian kreator konten"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            minRows={2}
            disabled={busy}
          />

          <Group grow>
            <NumberInput
              label="Harga Final (IDR)"
              placeholder="50000"
              required
              min={1000}
              step={5000}
              thousandSeparator="."
              decimalSeparator=","
              prefix="Rp "
              value={amountIdr}
              onChange={setAmountIdr}
              disabled={busy}
            />

            <NumberInput
              label="Harga Coret Promo (Opsional)"
              placeholder="75000"
              min={1000}
              step={5000}
              thousandSeparator="."
              decimalSeparator=","
              prefix="Rp "
              value={originalAmountIdr}
              onChange={setOriginalAmountIdr}
              disabled={busy}
              description="Tampil dicoret sebagai harga normal"
            />
          </Group>

          <Group grow>
            <NumberInput
              label="Poin Didapat"
              placeholder="500"
              required
              min={1}
              step={50}
              thousandSeparator="."
              decimalSeparator=","
              value={points}
              onChange={setPoints}
              disabled={busy}
            />

            <TextInput
              label="Badge Teks Promo (Opsional)"
              placeholder="Contoh: HEMAT 30%, POPULER"
              value={badgeText}
              onChange={(e) => setBadgeText(e.currentTarget.value)}
              disabled={busy}
            />
          </Group>

          <Group justify="space-between" mt="xs">
            <NumberInput
              label="Urutan Tampil (Sort Order)"
              value={sortOrder}
              onChange={setSortOrder}
              min={0}
              max={999}
              maw={160}
              disabled={busy}
            />

            <Switch
              label="Paket Aktif (Tampil ke Pengguna)"
              checked={active}
              onChange={(e) => setActive(e.currentTarget.checked)}
              disabled={busy}
              mt="md"
            />
          </Group>

          <Group justify="flex-end" mt="lg">
            <Button
              variant="default"
              onClick={() => setFormOpen(false)}
              disabled={busy}
            >
              Batal
            </Button>
            <Button
              color="blue"
              onClick={() => void handleSubmitForm()}
              loading={busy}
            >
              {editingPackage ? "Simpan Perubahan" : "Buat Paket"}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal Delete Confirmation */}
      <Modal
        opened={Boolean(deletingPackage)}
        onClose={() => !busy && setDeletingPackage(null)}
        title="Konfirmasi Hapus Paket"
        centered
      >
        <Stack gap="sm">
          <Text size="sm">
            Apakah Anda yakin ingin menghapus paket{" "}
            <strong>{deletingPackage?.name}</strong> senilai{" "}
            <strong>{deletingPackage ? formatIdr(deletingPackage.amountIdr) : ""}</strong> (+
            {deletingPackage?.points} Poin)?
          </Text>
          <Text size="xs" c="dimmed">
            Paket ini tidak akan tampil lagi di halaman pemesanan pelanggan.
          </Text>
          <Group justify="flex-end" mt="md">
            <Button
              variant="default"
              onClick={() => setDeletingPackage(null)}
              disabled={busy}
            >
              Batal
            </Button>
            <Button
              color="red"
              onClick={() => void handleDelete()}
              loading={busy}
            >
              Ya, Hapus Paket
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
