"use client";

import { useEffect, useState } from "react";
import {
  Autocomplete,
  Button,
  Divider,
  Group,
  Modal,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { ErrorAlert } from "@/components/error-alert";
import { useI18n } from "@/lib/i18n";
import {
  MAX_TEMPLATE_REFERENCES,
  TEMPLATE_ASPECT_RATIOS,
  TEMPLATE_MODEL_IDS,
  type AdminTemplate,
  type TemplateAssetValue,
  type TemplateFormPayload,
} from "../types";
import { TemplateImagePicker } from "./template-image-picker";

const ALIAS_RE = /^[a-zA-Z0-9_]{1,24}$/;

type ReferenceDraft = {
  localKey: string;
  asset: TemplateAssetValue | null;
  alias: string;
};

export type TemplateFormModalProps = {
  opened: boolean;
  onClose: () => void;
  template: AdminTemplate | null;
  categories: string[];
  busy: boolean;
  submitError?: string;
  submitErrorCode?: string;
  submitErrorTxId?: string;
  onSubmit: (payload: TemplateFormPayload) => Promise<void>;
};

export function TemplateFormModal({
  opened,
  onClose,
  template,
  categories,
  busy,
  submitError,
  submitErrorCode,
  submitErrorTxId,
  onSubmit,
}: TemplateFormModalProps) {
  const t = useI18n("admin");

  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [category, setCategory] = useState("");
  const [modelId, setModelId] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [modeValue, setModeValue] = useState<"safe" | "spicy">("safe");
  const [isActive, setIsActive] = useState(true);
  const [sortOrder, setSortOrder] = useState<number | string>(0);
  const [cover, setCover] = useState<TemplateAssetValue | null>(null);
  const [references, setReferences] = useState<ReferenceDraft[]>([]);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!opened) return;
    setValidationError("");
    if (template) {
      setTitle(template.title);
      setPrompt(template.prompt);
      setCategory(template.category ?? "");
      setModelId(template.modelId ?? "");
      setAspectRatio(template.aspectRatio || "1:1");
      setModeValue(template.isSpicy ? "spicy" : "safe");
      setIsActive(template.isActive);
      setSortOrder(template.sortOrder);
      setCover(template.cover);
      setReferences(
        template.images.map((img, idx) => ({
          localKey: img.id || `ref-${idx}`,
          asset: {
            key: img.key,
            url: img.url,
            width: img.width,
            height: img.height,
          },
          alias: img.alias ?? "",
        })),
      );
    } else {
      setTitle("");
      setPrompt("");
      setCategory("");
      setModelId("");
      setAspectRatio("1:1");
      setModeValue("safe");
      setIsActive(true);
      setSortOrder(0);
      setCover(null);
      setReferences([]);
    }
  }, [opened, template]);

  const handleAddReference = () => {
    if (references.length >= MAX_TEMPLATE_REFERENCES) return;
    setReferences((prev) => [
      ...prev,
      {
        localKey: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        asset: null,
        alias: "",
      },
    ]);
  };

  const handleRemoveReference = (localKey: string) => {
    setReferences((prev) => prev.filter((item) => item.localKey !== localKey));
  };

  const handleReferenceAssetChange = (localKey: string, nextAsset: TemplateAssetValue | null) => {
    setReferences((prev) =>
      prev.map((item) => (item.localKey === localKey ? { ...item, asset: nextAsset } : item)),
    );
  };

  const handleReferenceAliasChange = (localKey: string, nextAlias: string) => {
    setReferences((prev) =>
      prev.map((item) => (item.localKey === localKey ? { ...item, alias: nextAlias } : item)),
    );
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setValidationError(t("templates.error_title_required"));
      return;
    }

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setValidationError(t("templates.error_prompt_required"));
      return;
    }

    if (!cover) {
      setValidationError(t("templates.error_cover_required"));
      return;
    }

    const validImages: TemplateFormPayload["images"] = [];
    for (const ref of references) {
      if (!ref.asset) {
        setValidationError(t("templates.error_ref_image_required"));
        return;
      }
      const trimmedAlias = ref.alias.trim();
      if (trimmedAlias.length > 0 && !ALIAS_RE.test(trimmedAlias)) {
        setValidationError(t("templates.error_alias_invalid"));
        return;
      }
      validImages.push({
        key: ref.asset.key,
        alias: trimmedAlias || null,
        width: ref.asset.width,
        height: ref.asset.height,
      });
    }

    setValidationError("");
    const parsedSort =
      typeof sortOrder === "number" ? Math.trunc(sortOrder) : parseInt(String(sortOrder || "0"), 10);

    const payload: TemplateFormPayload = {
      title: trimmedTitle,
      prompt: trimmedPrompt,
      category: category.trim() || null,
      modelId: modelId || null,
      aspectRatio,
      isSpicy: modeValue === "spicy",
      isActive,
      sortOrder: Number.isFinite(parsedSort) ? parsedSort : 0,
      cover: {
        key: cover.key,
        width: cover.width,
        height: cover.height,
      },
      images: validImages,
    };

    await onSubmit(payload);
  };

  const modelOptions = [
    { value: "", label: t("templates.placeholder_model") },
    ...TEMPLATE_MODEL_IDS.map((id) => ({ value: id, label: id })),
  ];

  const aspectOptions = TEMPLATE_ASPECT_RATIOS.map((ratio) => ({
    value: ratio,
    label: ratio,
  }));

  const activeError = validationError || submitError || "";

  return (
    <Modal
      opened={opened}
      onClose={() => !busy && onClose()}
      title={
        template
          ? t("templates.modal_edit_title", { title: template.title })
          : t("templates.modal_create_title")
      }
      size="lg"
      centered
    >
      <Stack gap="sm">
        <TextInput
          label={t("templates.field_title")}
          placeholder={t("templates.placeholder_title")}
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          disabled={busy}
        />

        <Textarea
          label={t("templates.field_prompt")}
          placeholder={t("templates.placeholder_prompt")}
          required
          autosize
          minRows={3}
          maxRows={6}
          maxLength={4000}
          value={prompt}
          onChange={(e) => setPrompt(e.currentTarget.value)}
          disabled={busy}
        />

        <Group grow align="flex-start">
          <Autocomplete
            label={t("templates.field_category")}
            placeholder={t("templates.placeholder_category")}
            data={categories}
            maxLength={40}
            value={category}
            onChange={setCategory}
            disabled={busy}
          />

          <Select
            label={t("templates.field_model")}
            data={modelOptions}
            value={modelId}
            onChange={(val) => setModelId(val ?? "")}
            allowDeselect={false}
            disabled={busy}
          />
        </Group>

        <Group grow align="flex-end">
          <Select
            label={t("templates.field_aspect_ratio")}
            data={aspectOptions}
            value={aspectRatio}
            onChange={(val) => setAspectRatio(val || "1:1")}
            allowDeselect={false}
            disabled={busy}
          />

          <Stack gap={4}>
            <Text size="sm" fw={500}>
              {t("templates.field_mode")}
            </Text>
            <SegmentedControl
              value={modeValue}
              onChange={(val) => setModeValue(val === "spicy" ? "spicy" : "safe")}
              disabled={busy}
              data={[
                { value: "safe", label: t("templates.mode_safe") },
                { value: "spicy", label: t("templates.mode_spicy") },
              ]}
            />
          </Stack>
        </Group>

        <Group justify="space-between" align="center">
          <NumberInput
            label={t("templates.field_sort_order")}
            value={sortOrder}
            onChange={setSortOrder}
            allowDecimal={false}
            maw={160}
            disabled={busy}
          />

          <Switch
            label={t("templates.field_active")}
            checked={isActive}
            onChange={(e) => setIsActive(e.currentTarget.checked)}
            disabled={busy}
            mt="md"
          />
        </Group>

        <Divider my="xs" />

        <TemplateImagePicker
          label={t("templates.field_cover")}
          required
          value={cover}
          onChange={setCover}
          disabled={busy}
        />

        <Divider my="xs" />

        <Stack gap="xs">
          <Group justify="space-between" align="center">
            <Text size="sm" fw={500}>
              {t("templates.field_references")}
            </Text>
            <Button
              type="button"
              size="xs"
              variant="light"
              disabled={busy || references.length >= MAX_TEMPLATE_REFERENCES}
              onClick={handleAddReference}
            >
              {t("templates.btn_add_ref")}
            </Button>
          </Group>

          {references.map((ref, idx) => (
            <Paper key={ref.localKey} withBorder p="sm" radius="md">
              <Stack gap="xs">
                <Group justify="space-between" align="center">
                  <Text size="xs" fw={600} c="dimmed">
                    {t("templates.ref_item_title", { index: idx + 1 })}
                  </Text>
                  <Button
                    type="button"
                    size="xs"
                    variant="subtle"
                    color="red"
                    disabled={busy}
                    onClick={() => handleRemoveReference(ref.localKey)}
                  >
                    {t("templates.btn_remove_ref")}
                  </Button>
                </Group>

                <TemplateImagePicker
                  label={`${t("templates.ref_item_title", { index: idx + 1 })}`}
                  value={ref.asset}
                  onChange={(nextAsset) => handleReferenceAssetChange(ref.localKey, nextAsset)}
                  disabled={busy}
                />

                <TextInput
                  size="xs"
                  label={t("templates.field_alias")}
                  placeholder={t("templates.placeholder_alias")}
                  maxLength={24}
                  value={ref.alias}
                  onChange={(e) => handleReferenceAliasChange(ref.localKey, e.currentTarget.value)}
                  disabled={busy}
                />
              </Stack>
            </Paper>
          ))}
        </Stack>

        <ErrorAlert
          message={activeError}
          code={!validationError ? submitErrorCode : undefined}
          transactionId={!validationError ? submitErrorTxId : undefined}
        />

        <Group justify="flex-end" mt="md">
          <Button type="button" variant="default" onClick={onClose} disabled={busy}>
            {t("templates.btn_cancel")}
          </Button>
          <Button
            type="button"
            variant="gradient"
            gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
            onClick={() => void handleSave()}
            loading={busy}
          >
            {template ? t("templates.btn_save") : t("templates.btn_create")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
