"use client";

import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ErrorAlert } from "@/components/error-alert";
import { requestJson } from "@/lib/api";
import type { AdminModelItem } from "../types";

export function ModelCatalogTable({ models }: { models: AdminModelItem[] }) {
  const router = useRouter();
  const [editingModel, setEditingModel] = useState<AdminModelItem | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [displayName, setDisplayName] = useState("");
  const [costPoints, setCostPoints] = useState<number>(10);
  const [enabled, setEnabled] = useState(true);
  const [isSpicy, setIsSpicy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function startEdit(model: AdminModelItem) {
    setEditingModel(model);
    setDisplayName(model.displayName);
    setCostPoints(model.costPoints);
    setEnabled(model.enabled);
    setIsSpicy(model.isSpicy);
    setError("");
    open();
  }

  async function saveEdit() {
    if (!editingModel) return;
    setError("");
    setBusy(true);

    const res = await requestJson<{ id: string }>(`/api/admin/models/${editingModel.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        displayName: displayName.trim(),
        costPoints,
        enabled,
        isSpicy,
      }),
    });

    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }

    close();
    router.refresh();
  }

  return (
    <Card withBorder radius="md" p="md">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={4}>Katalog Model Provider</Title>
          <Text size="sm" c="dimmed">
            Daftar seluruh model AI yang terdaftar di database. Anda dapat menyesuaikan nama tampilan, biaya poin, serta status aktif/nonaktif.
          </Text>
        </div>
      </Group>

      <Table.ScrollContainer minWidth={650}>
        <Table verticalSpacing="sm" striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Model & Display Name</Table.Th>
              <Table.Th>Kategori / Mode</Table.Th>
              <Table.Th>Provider</Table.Th>
              <Table.Th>Tipe</Table.Th>
              <Table.Th>Biaya Poin</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Aksi</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {models.map((model) => {
              const isVideo = model.mode === "i2v" || model.mode === "t2v";
              return (
                <Table.Tr key={model.id}>
                  <Table.Td>
                    <Text fw={600} size="sm">
                      {model.displayName || model.modelId}
                    </Text>
                    <Text size="xs" c="dimmed" ff="monospace">
                      {model.modelId}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={isVideo ? "grape" : "blue"} variant="light" size="sm">
                      {isVideo ? `Video (${model.mode})` : `Image (${model.mode})`}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{model.providerId}</Text>
                  </Table.Td>
                  <Table.Td>
                    {model.isSpicy ? (
                      <Badge color="red" variant="filled" size="sm">
                        🔥 Spicy
                      </Badge>
                    ) : (
                      <Badge color="gray" variant="light" size="sm">
                        Standar
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text fw={600} size="sm">
                      {model.costPoints} poin
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={model.enabled ? "teal" : "gray"} variant="dot" size="sm">
                      {model.enabled ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Button variant="subtle" size="xs" onClick={() => startEdit(model)}>
                      Edit
                    </Button>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      <Modal opened={opened} onClose={close} title="Edit Model Catalog" centered>
        {editingModel ? (
          <Stack gap="sm">
            <Text size="xs" c="dimmed" ff="monospace">
              ID: {editingModel.modelId} ({editingModel.mode})
            </Text>

            <TextInput
              label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.currentTarget.value)}
              required
            />

            <NumberInput
              label="Biaya Poin (Cost Points)"
              min={0}
              max={1000}
              value={costPoints}
              onChange={(val) => {
                if (typeof val === "number") setCostPoints(val);
              }}
              required
            />

            <Switch
              label="Status Aktif (Enabled)"
              description="Jika dinonaktifkan, model tidak akan muncul bagi pelanggan"
              checked={enabled}
              onChange={(e) => setEnabled(e.currentTarget.checked)}
              mt="xs"
            />

            <Switch
              label="Mode Spicy"
              description="Tandai apakah model ini masuk ke kategori Spicy Content"
              checked={isSpicy}
              onChange={(e) => setIsSpicy(e.currentTarget.checked)}
              mt="xs"
            />

            <ErrorAlert message={error} />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={close} disabled={busy}>
                Batal
              </Button>
              <Button onClick={() => void saveEdit()} loading={busy}>
                Simpan
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </Card>
  );
}
