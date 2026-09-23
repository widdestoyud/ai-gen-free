"use client";

import { Alert, Badge, Button, Card, Divider, Group, Paper, Select, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ErrorAlert } from "@/components/error-alert";
import { requestJson } from "@/lib/api";
import type { AdminModelItem, DefaultGenerationModelsConfig } from "../types";

export function ModelDefaultsForm({
  initialConfig,
  models = [],
}: {
  initialConfig: DefaultGenerationModelsConfig;
  models: AdminModelItem[];
}) {
  const router = useRouter();
  const [config, setConfig] = useState<DefaultGenerationModelsConfig>(() => initialConfig || {
    normalT2iModelId: "openai/gpt-image-2-t2i",
    normalI2iModelId: "openai/gpt-image-2-edit",
    spicyT2iModelId: "bytedance/seedream-5.0-pro-t2i-spicy",
    spicyI2iModelId: "alibaba/qwen-image-3-edit-spicy",
    normalVideoModelId: "bytedance/seedance-2.5-i2v",
    spicyVideoModelId: "bytedance/seedance-2.0-i2v-spicy",
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  function getUniqueOptions(items: AdminModelItem[]) {
    const seen = new Set<string>();
    const options: { value: string; label: string }[] = [];
    for (const m of items) {
      if (!seen.has(m.modelId)) {
        seen.add(m.modelId);
        options.push({
          value: m.modelId,
          label: `${m.isSpicy ? "🔥 " : ""}${m.displayName || m.modelId} (${m.providerId} · ${m.costPoints} poin)`,
        });
      }
    }
    return options;
  }

  // Filter video models (i2v / t2v)
  const videoNormalOptions = getUniqueOptions(
    models.filter((m) => (m.mode === "i2v" || m.mode === "t2v") && !m.isSpicy && m.enabled)
  );

  const videoSpicyOptions = getUniqueOptions(
    models.filter((m) => (m.mode === "i2v" || m.mode === "t2v") && m.isSpicy && m.enabled)
  );

  // Filter image models (t2i / i2i)
  const imageT2iNormalOptions = getUniqueOptions(
    models.filter((m) => m.mode === "t2i" && !m.isSpicy && m.enabled)
  );

  const imageI2iNormalOptions = getUniqueOptions(
    models.filter((m) => m.mode === "i2i" && !m.isSpicy && m.enabled)
  );

  const imageT2iSpicyOptions = getUniqueOptions(
    models.filter((m) => m.mode === "t2i" && m.isSpicy && m.enabled)
  );

  const imageI2iSpicyOptions = getUniqueOptions(
    models.filter((m) => m.mode === "i2i" && m.isSpicy && m.enabled)
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);

    // Frontend validation: ensure strict separation
    const selectedNormalVideo = models.find((m) => m.modelId === config.normalVideoModelId);
    if (selectedNormalVideo && selectedNormalVideo.mode !== "i2v" && selectedNormalVideo.mode !== "t2v") {
      setError("Model Video Normal harus merupakan model berjenis video (i2v / t2v).");
      return;
    }

    const selectedSpicyVideo = models.find((m) => m.modelId === config.spicyVideoModelId);
    if (selectedSpicyVideo && selectedSpicyVideo.mode !== "i2v" && selectedSpicyVideo.mode !== "t2v") {
      setError("Model Video Spicy harus merupakan model berjenis video (i2v / t2v).");
      return;
    }

    const selectedT2i = models.find((m) => m.modelId === config.normalT2iModelId);
    if (selectedT2i && (selectedT2i.mode === "i2v" || selectedT2i.mode === "t2v")) {
      setError("Model gambar tidak boleh menggunakan model video.");
      return;
    }

    setBusy(true);
    const result = await requestJson<{ key: string; value: DefaultGenerationModelsConfig }>(
      "/api/admin/models/settings",
      {
        method: "PUT",
        body: JSON.stringify(config),
      },
    );
    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)}>
      <Stack gap="lg">
        {/* Section 1: Pengaturan Model Video */}
        <Card withBorder radius="md" p="md">
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <Title order={4}>Model Video Studio (Video Generation)</Title>
              <Badge color="grape" variant="light">
                Video Only
              </Badge>
            </Group>
          </Group>
          <Text size="sm" c="dimmed" mb="md">
            Atur model default yang otomatis terpilih saat pelanggan memilih mode Video di studio generator (/app/generate). Model gambar dilarang digunakan untuk slot video.
          </Text>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Select
              label="Model Video Normal / Standar"
              description="Digunakan saat pelanggan memilih mode Video dengan filter standar"
              data={videoNormalOptions}
              value={config.normalVideoModelId}
              onChange={(val) => {
                if (val) setConfig((prev) => ({ ...prev, normalVideoModelId: val }));
              }}
              required
              searchable
            />

            <Select
              label="Model Video Spicy"
              description="Digunakan saat pelanggan memilih mode Video dengan filter Spicy aktif"
              data={videoSpicyOptions}
              value={config.spicyVideoModelId}
              onChange={(val) => {
                if (val) setConfig((prev) => ({ ...prev, spicyVideoModelId: val }));
              }}
              required
              searchable
            />
          </SimpleGrid>
        </Card>

        {/* Section 2: Pengaturan Model Gambar */}
        <Card withBorder radius="md" p="md">
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              <Title order={4}>Model Gambar Studio (Image Generation)</Title>
              <Badge color="blue" variant="light">
                Image Only
              </Badge>
            </Group>
          </Group>
          <Text size="sm" c="dimmed" mb="md">
            Atur model default yang otomatis terpilih saat pelanggan memilih mode Gambar di studio generator (/app/generate). Model video dilarang digunakan untuk slot gambar.
          </Text>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Select
              label="Model Gambar T2I Normal"
              description="Generate gambar dari teks (Text to Image) mode normal"
              data={imageT2iNormalOptions}
              value={config.normalT2iModelId}
              onChange={(val) => {
                if (val) setConfig((prev) => ({ ...prev, normalT2iModelId: val }));
              }}
              required
              searchable
            />

            <Select
              label="Model Gambar I2I Edit Normal"
              description="Edit gambar dengan referensi (Image to Image) mode normal"
              data={imageI2iNormalOptions}
              value={config.normalI2iModelId}
              onChange={(val) => {
                if (val) setConfig((prev) => ({ ...prev, normalI2iModelId: val }));
              }}
              required
              searchable
            />

            <Select
              label="Model Gambar T2I Spicy"
              description="Generate gambar dari teks (Text to Image) mode Spicy"
              data={imageT2iSpicyOptions}
              value={config.spicyT2iModelId}
              onChange={(val) => {
                if (val) setConfig((prev) => ({ ...prev, spicyT2iModelId: val }));
              }}
              required
              searchable
            />

            <Select
              label="Model Gambar I2I Edit Spicy"
              description="Edit gambar dengan referensi (Image to Image) mode Spicy"
              data={imageI2iSpicyOptions}
              value={config.spicyI2iModelId}
              onChange={(val) => {
                if (val) setConfig((prev) => ({ ...prev, spicyI2iModelId: val }));
              }}
              required
              searchable
            />
          </SimpleGrid>
        </Card>

        <ErrorAlert message={error} />

        {saved ? (
          <Alert color="teal" variant="light" title="Berhasil Disimpan">
            Konfigurasi model aktif studio berhasil diperbarui. Perubahan langsung berlaku di halaman generator pelanggan.
          </Alert>
        ) : null}

        <Group justify="flex-end">
          <Button type="submit" loading={busy}>
            Simpan Konfigurasi Model
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
