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
  function handleAddRefClick() {
    onClose();
    onOpenLibrary();
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Pengaturan Studio"
      size="md"
      radius="lg"
      centered
    >
      <Stack gap="lg">
        {/* Referensi Gambar */}
        <Stack gap="xs">
          <Group justify="space-between" align="center">
            <Text size="sm" fw={600} c="white">
              Referensi Gambar
            </Text>
            {selectedRefs.length > 0 ? (
              <Badge size="sm" variant="light" color="blue">
                {selectedRefs.length} gambar terpilih
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
              ? "Kelola Gambar Referensi"
              : "+ Tambah Gambar Referensi"}
          </Button>
        </Stack>

        <Divider color="dark.4" />

        {/* Mode Standar / Spicy (hanya jika mode spicy pada profile diaktifkan) */}
        {spicyModeEnabled ? (
          <>
            <Stack gap="xs">
              <Text size="sm" fw={600} c="white">
                Mode Model
              </Text>
              <div className={classes.settingsPillRow}>
                <button
                  type="button"
                  className={`${classes.settingsPillBtn} ${spicyFilter === "normal" ? classes.settingsPillBtnActive : ""}`}
                  onClick={() => onSpicyFilterChange("normal")}
                >
                  Standard
                </button>
                <button
                  type="button"
                  className={`${classes.settingsPillBtn} ${spicyFilter === "spicy" ? classes.settingsPillBtnSpicyActive : ""}`}
                  onClick={() => onSpicyFilterChange("spicy")}
                >
                  Spicy
                </button>
              </div>
            </Stack>
            <Divider color="dark.4" />
          </>
        ) : null}

        {/* Aspek Rasio */}
        <Stack gap="xs">
          <Text size="sm" fw={600} c="white">
            Aspek Rasio
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
                  Durasi Video
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
                  Resolusi Video
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

        <Button fullWidth color="blue" size="md" radius="md" onClick={onClose} mt="xs">
          Selesai
        </Button>
      </Stack>
    </Modal>
  );
}
