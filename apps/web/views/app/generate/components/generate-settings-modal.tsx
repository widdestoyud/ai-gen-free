"use client";

import {
  Badge,
  Button,
  Divider,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  CheckIcon,
  ClockIcon,
  ImageIcon,
  ResolutionIcon,
} from "./generate-icons";
import { STUDIO_ASPECTS } from "@/lib/aspect-ratio";
import type { StudioRef } from "@/hooks/use-generate-studio";
import { useI18n } from "@/lib/i18n";
import classes from "./generate-studio.module.css";

const DURATIONS: Array<"6s" | "10s" | "15s"> = ["6s", "10s", "15s"];
const RESOLUTIONS: Array<"480p" | "720p" | "1080p"> = ["480p", "720p", "1080p"];

export interface GenerateSettingsModalProps {
  opened: boolean;
  onClose: () => void;
  mediaType: "image" | "video";
  spicyModeEnabled: boolean;
  spicyFilter: "normal" | "spicy";
  onSpicyFilterChange: (filter: "normal" | "spicy") => void;
  aspectRatio: string;
  onAspectRatioChange: (ratio: string) => void;
  videoResolution: "480p" | "720p" | "1080p";
  onVideoResolutionChange: (res: "480p" | "720p" | "1080p") => void;
  videoDuration: "6s" | "10s" | "15s";
  onVideoDurationChange: (dur: "6s" | "10s" | "15s") => void;
  selectedRefs: StudioRef[];
  onOpenLibrary: () => void;
}

export function GenerateSettingsModal({
  opened,
  onClose,
  mediaType,
  spicyModeEnabled,
  spicyFilter,
  onSpicyFilterChange,
  aspectRatio,
  onAspectRatioChange,
  videoResolution,
  onVideoResolutionChange,
  videoDuration,
  onVideoDurationChange,
  selectedRefs,
  onOpenLibrary,
}: GenerateSettingsModalProps) {
  const { t } = useI18n("generate");

  function handleAddRefClick() {
    onClose();
    onOpenLibrary();
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("settings_modal.title")}
      size="md"
      radius="lg"
      centered
    >
      <Stack gap="lg">
        {/* Referensi Gambar */}
        <Stack gap="xs">
          <Group justify="space-between" align="center">
            <Text size="sm" fw={600} c="white">
              {t("settings_modal.ref_images")}
            </Text>
            {selectedRefs.length > 0 ? (
              <Badge size="sm" variant="light" color="blue">
                {t("settings_modal.selected_count", { count: selectedRefs.length })}
              </Badge>
            ) : null}
          </Group>

          <Button
            type="button"
            variant="light"
            color="blue"
            fullWidth
            leftSection={<ImageIcon size={16} />}
            onClick={handleAddRefClick}
          >
            {selectedRefs.length > 0
              ? t("settings_modal.manage_refs")
              : t("settings_modal.add_refs")}
          </Button>
        </Stack>

        <Divider color="dark.4" />

        {/* Mode Standar / Spicy (hanya jika mode spicy pada profile diaktifkan) */}
        {spicyModeEnabled ? (
          <>
            <Stack gap="xs">
              <Text size="sm" fw={600} c="white">
                {t("settings_modal.model_mode")}
              </Text>
              <div className={classes.settingsPillRow}>
                <button
                  type="button"
                  className={`${classes.settingsPillBtn} ${spicyFilter === "normal" ? classes.settingsPillBtnActive : ""}`}
                  onClick={() => onSpicyFilterChange("normal")}
                >
                  {t("mode_standard")}
                </button>
                <button
                  type="button"
                  className={`${classes.settingsPillBtn} ${spicyFilter === "spicy" ? classes.settingsPillBtnSpicyActive : ""}`}
                  onClick={() => onSpicyFilterChange("spicy")}
                >
                  {t("mode_spicy")}
                </button>
              </div>
            </Stack>
            <Divider color="dark.4" />
          </>
        ) : null}

        {/* Aspek Rasio */}
        <Stack gap="xs">
          <Text size="sm" fw={600} c="white">
            {t("settings_modal.aspect_ratio")}
          </Text>
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
            {STUDIO_ASPECTS.map((item) => {
              const isSelected = item.value === aspectRatio;
              const previewClass =
                item.preview === "tall"
                  ? classes.previewSmTall
                  : item.preview === "square"
                    ? classes.previewSmSquare
                    : classes.previewSmWide;

              return (
                <UnstyledButton
                  key={item.value}
                  className={`${classes.aspectCard} ${isSelected ? classes.aspectCardActive : ""}`}
                  onClick={() => onAspectRatioChange(item.value)}
                >
                  <Group justify="space-between" align="center" mb={4}>
                    <Text size="sm" fw={isSelected ? 700 : 500} c={isSelected ? "blue.4" : "white"}>
                      {item.value}
                    </Text>
                    {isSelected ? <CheckIcon size={14} color="#3b82f6" /> : null}
                  </Group>
                  <Group gap="xs" align="center">
                    <div className={classes.previewContainerSm}>
                      <div className={previewClass} />
                    </div>
                    <Text size="xs" c="dimmed">
                      {item.label.split(" ")[1] ?? item.dimension}
                    </Text>
                  </Group>
                </UnstyledButton>
              );
            })}
          </SimpleGrid>
        </Stack>

        {/* Pengaturan Khusus Video (Durasi & Resolusi) */}
        {mediaType === "video" ? (
          <>
            <Divider color="dark.4" />
            <Stack gap="md">
              <Stack gap="xs">
                <Text size="sm" fw={600} c="white">
                  {t("settings_modal.video_duration")}
                </Text>
                <div className={classes.settingsPillRow}>
                  {DURATIONS.map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      className={`${classes.settingsPillBtn} ${videoDuration === dur ? classes.settingsPillBtnActive : ""}`}
                      onClick={() => onVideoDurationChange(dur)}
                    >
                      <ClockIcon size={13} />
                      <span>{dur}</span>
                    </button>
                  ))}
                </div>
              </Stack>

              <Stack gap="xs">
                <Text size="sm" fw={600} c="white">
                  {t("settings_modal.video_resolution")}
                </Text>
                <div className={classes.settingsPillRow}>
                  {RESOLUTIONS.map((res) => (
                    <button
                      key={res}
                      type="button"
                      className={`${classes.settingsPillBtn} ${videoResolution === res ? classes.settingsPillBtnActive : ""}`}
                      onClick={() => onVideoResolutionChange(res)}
                    >
                      <ResolutionIcon size={13} />
                      <span>{res}</span>
                    </button>
                  ))}
                </div>
              </Stack>
            </Stack>
          </>
        ) : null}

        <Button
          fullWidth
          variant="gradient"
          gradient={{ from: "#3b82f6", to: "#8b5cf6", deg: 135 }}
          size="md"
          radius="md"
          onClick={onClose}
          mt="xs"
        >
          {t("settings_modal.btn_done")}
        </Button>
      </Stack>
    </Modal>
  );
}
