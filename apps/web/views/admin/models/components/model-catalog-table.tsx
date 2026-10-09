"use client";

import {
  Accordion,
  ActionIcon,
  Badge,
  Button,
  Card,
  Divider,
  Grid,
  Group,
  Modal,
  NumberInput,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ResponsiveTable } from "@/components/responsive-table";
import { ErrorAlert } from "@/components/error-alert";
import { requestJson } from "@/lib/api";
import type { AdminModelItem } from "../types";

const DEFAULT_VIDEO_CONFIG: Record<string, number> = {
  "6s_480p": 100,
  "6s_720p": 210,
  "6s_1080p": 500,
  "10s_480p": 155,
  "10s_720p": 345,
  "10s_1080p": 820,
  "15s_480p": 235,
  "15s_720p": 510,
  "15s_1080p": 1230,
};

const VIDEO_DURATIONS = [
  { key: "6s", label: "6 Detik", costHint: "480p: $0.90 | 720p: $1.90 | 1080p: $4.50" },
  { key: "10s", label: "10 Detik", costHint: "480p: $1.40 | 720p: $3.10 | 1080p: $7.40" },
  { key: "15s", label: "15 Detik", costHint: "480p: $2.10 | 720p: $4.60 | 1080p: $11.10" },
] as const;

const VIDEO_RESOLUTIONS = [
  { key: "480p", label: "480p (SD)" },
  { key: "720p", label: "720p (HD)" },
  { key: "1080p", label: "1080p (FHD)" },
] as const;

function renderProviderBadge(providerId: string) {
  const p = (providerId || "").toLowerCase();
  if (p === "falai" || p === "fal") {
    return (
      <Badge color="cyan" variant="light" size="sm">
        fal.ai
      </Badge>
    );
  }
  if (p === "siray") {
    return (
      <Badge color="indigo" variant="light" size="sm">
        Siray
      </Badge>
    );
  }
  return (
    <Badge color="gray" variant="light" size="sm">
      {providerId}
    </Badge>
  );
}

export function ModelCatalogTable({
  models = [],
  selectedProvider = "all",
}: {
  models?: AdminModelItem[];
  selectedProvider?: string;
}) {
  const router = useRouter();
  const [editingModel, setEditingModel] = useState<AdminModelItem | null>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const [displayName, setDisplayName] = useState("");
  const [costPoints, setCostPoints] = useState<number>(10);
  const [videoConfig, setVideoConfig] = useState<Record<string, number>>({ ...DEFAULT_VIDEO_CONFIG });
  const [enabled, setEnabled] = useState(true);
  const [isSpicy, setIsSpicy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isEditingVideo = editingModel?.mode === "i2v" || editingModel?.mode === "t2v";

  function handleProviderChange(value: string) {
    if (value === "all") {
      router.push("/admin/models");
    } else {
      router.push(`/admin/models?provider=${encodeURIComponent(value)}`);
    }
  }

  function startEdit(model: AdminModelItem) {
    setEditingModel(model);
    setDisplayName(model.displayName);
    setCostPoints(model.costPoints);
    setVideoConfig({
      ...DEFAULT_VIDEO_CONFIG,
      ...(model.videoConfigPoints ?? {}),
    });
    setEnabled(model.enabled);
    setIsSpicy(model.isSpicy);
    setError("");
    open();
  }

  function applyDefaultVideoPreset() {
    setVideoConfig({ ...DEFAULT_VIDEO_CONFIG });
    setCostPoints(100);
  }

  function handleVideoConfigChange(duration: string, resolution: string, val: number | string) {
    const num = typeof val === "number" ? val : parseInt(String(val), 10);
    if (!isNaN(num) && num >= 0) {
      setVideoConfig((prev) => ({
        ...prev,
        [`${duration}_${resolution}`]: num,
      }));
    }
  }

  async function saveEdit() {
    if (!editingModel) return;
    setError("");
    setBusy(true);

    const isVideo = editingModel.mode === "i2v" || editingModel.mode === "t2v";

    const res = await requestJson<{ id: string }>(`/api/admin/models/${editingModel.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        displayName: displayName.trim(),
        costPoints,
        videoConfigPoints: isVideo ? videoConfig : undefined,
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
      <Group justify="space-between" align="flex-start" mb="md">
        <div>
          <Title order={4}>Katalog Model Provider</Title>
          <Text size="sm" c="dimmed">
            Daftar seluruh model AI yang terdaftar di database. Anda dapat menyesuaikan nama tampilan, biaya poin bertingkat untuk video, serta status aktif/nonaktif.
          </Text>
        </div>

        <SegmentedControl
          value={selectedProvider}
          onChange={handleProviderChange}
          data={[
            { label: "Semua Provider", value: "all" },
            { label: "Siray", value: "siray" },
            { label: "fal.ai", value: "falai" },
          ]}
          size="xs"
        />
      </Group>

      <ResponsiveTable
        data={models}
        keyExtractor={(model) => model.id}
        striped
        highlightOnHover
        renderHeader={() => (
          <Table.Tr>
            <Table.Th>Model & Display Name</Table.Th>
            <Table.Th>Kategori / Mode</Table.Th>
            <Table.Th>Provider</Table.Th>
            <Table.Th>Tipe</Table.Th>
            <Table.Th>Biaya Poin</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Aksi</Table.Th>
          </Table.Tr>
        )}
        renderRow={(model) => {
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
                <Badge
                  color={isVideo ? "grape" : model.mode === "inpaint" ? "cyan" : "blue"}
                  variant="light"
                  size="sm"
                >
                  {isVideo ? `Video (${model.mode})` : model.mode === "inpaint" ? "Inpaint" : `Image (${model.mode})`}
                </Badge>
              </Table.Td>
              <Table.Td>
                {renderProviderBadge(model.providerId)}
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
                {isVideo ? (
                  <div>
                    <Text fw={600} size="sm" c="grape">
                      100 – 1.230 poin
                    </Text>
                    <Text size="xs" c="dimmed">
                      Tergantung durasi & resolusi
                    </Text>
                  </div>
                ) : (
                  <Text fw={600} size="sm">
                    {model.costPoints} poin
                  </Text>
                )}
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
        }}
        renderMobileCard={(model) => {
          const isVideo = model.mode === "i2v" || model.mode === "t2v";
          return (
            <div
              key={model.id}
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <Text fw={600} size="sm">
                    {model.displayName || model.modelId}
                  </Text>
                  <Text size="xs" c="dimmed" style={{ fontFamily: "monospace" }}>
                    {model.modelId}
                  </Text>
                </div>
                <Group gap={6}>
                  <Badge
                    color={isVideo ? "grape" : model.mode === "inpaint" ? "cyan" : "blue"}
                    variant="light"
                    size="xs"
                  >
                    {isVideo ? `Video (${model.mode})` : model.mode === "inpaint" ? "Inpaint" : `Image (${model.mode})`}
                  </Badge>
                  {model.isSpicy && (
                    <Badge color="red" variant="filled" size="xs">
                      🔥 Spicy
                    </Badge>
                  )}
                </Group>
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
                    Provider & Status
                  </Text>
                  <Group gap={6} mt={2}>
                    {renderProviderBadge(model.providerId)}
                    <Badge color={model.enabled ? "teal" : "gray"} variant="dot" size="xs">
                      {model.enabled ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </Group>
                </div>
                <div style={{ textAlign: "right" }}>
                  <Text size="xs" c="dimmed">
                    Biaya Poin
                  </Text>
                  {isVideo ? (
                    <Text fw={600} size="xs" c="grape">
                      100 – 1.230 poin
                    </Text>
                  ) : (
                    <Text fw={600} size="xs">
                      {model.costPoints} poin
                    </Text>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button variant="light" size="xs" onClick={() => startEdit(model)}>
                  Edit Model
                </Button>
              </div>
            </div>
          );
        }}
      />

      <Modal opened={opened} onClose={close} title="Edit Model Catalog" size={isEditingVideo ? "lg" : "md"} centered>
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

            {!isEditingVideo ? (
              <NumberInput
                label="Biaya Poin (Cost Points)"
                min={0}
                max={5000}
                value={costPoints}
                onChange={(val) => {
                  if (typeof val === "number") setCostPoints(val);
                }}
                required
              />
            ) : (
              <Paper withBorder p="sm" radius="md" bg="var(--mantine-color-gray-0)">
                <Group justify="space-between" mb="xs">
                  <div>
                    <Text fw={600} size="sm">
                      Penyesuaian Biaya Poin Video
                    </Text>
                    <Text size="xs" c="dimmed">
                      Atur poin yang harus dibayar user untuk setiap kombinasi Durasi dan Resolusi.
                    </Text>
                  </div>
                  <Button variant="light" color="grape" size="compact-xs" onClick={applyDefaultVideoPreset}>
                    Preset Standar (Margin ~46%)
                  </Button>
                </Group>

                <Stack gap="xs" mt="xs">
                  {VIDEO_DURATIONS.map((dur) => (
                    <Paper key={dur.key} withBorder p="xs" radius="sm">
                      <Group justify="space-between" mb="xs">
                        <Badge variant="filled" color="grape" size="sm">
                          Durasi {dur.label}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          {dur.costHint}
                        </Text>
                      </Group>
                      <SimpleGrid cols={3} spacing="xs">
                        {VIDEO_RESOLUTIONS.map((res) => {
                          const configKey = `${dur.key}_${res.key}`;
                          const currentVal = videoConfig[configKey] ?? DEFAULT_VIDEO_CONFIG[configKey] ?? 100;
                          return (
                            <NumberInput
                              key={configKey}
                              size="xs"
                              label={`${res.label}`}
                              value={currentVal}
                              min={1}
                              max={10000}
                              onChange={(val) => handleVideoConfigChange(dur.key, res.key, val)}
                              suffix=" poin"
                            />
                          );
                        })}
                      </SimpleGrid>
                    </Paper>
                  ))}
                </Stack>
              </Paper>
            )}

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

