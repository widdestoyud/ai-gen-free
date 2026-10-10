"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Pagination,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { CheckIcon, PencilIcon, TrashIcon, ZoomIcon } from "./generate-icons";
import { isJobImage, type JobView } from "@/lib/job-status";
import type { StudioUpload } from "@/hooks/use-generate-studio";
import { useI18n } from "@/lib/i18n";
import classes from "./generate-studio.module.css";

const UPLOADS_PER_PAGE = 15;

type ZoomableItem = {
  id: string;
  url: string;
  name: string;
  alias?: string | null;
  width?: number | null;
  height?: number | null;
  kind?: "generation" | "upload";
};

type EditableItem = {
  id: string;
  alias?: string | null;
  kind: "generation" | "upload";
};

export function GenerateLibraryModal({
  opened,
  onClose,
  tab,
  onTab,
  generations,
  uploads,
  uploadPage = 1,
  uploadTotal = 0,
  onUploadPageChange,
  isSelected,
  selectedCount = 0,
  maxSelected = 5,
  onToggleGeneration,
  onToggleUpload,
  onUploadClick,
  onDeleteUpload,
  onUpdateAlias,
  uploadPolicyAccepted = true,
}: {
  opened: boolean;
  onClose: () => void;
  tab: "generations" | "uploads";
  onTab: (tab: "generations" | "uploads") => void;
  generations: JobView[];
  uploads: StudioUpload[];
  uploadPage?: number;
  uploadTotal?: number;
  onUploadPageChange?: (page: number) => void;
  isSelected: (id: string) => boolean;
  selectedCount?: number;
  maxSelected?: number;
  onToggleGeneration: (job: JobView) => void;
  onToggleUpload: (item: StudioUpload) => void;
  onUploadClick: () => void;
  onDeleteUpload?: (id: string) => Promise<boolean>;
  onUpdateAlias?: (id: string, alias: string, kind?: "generation" | "upload") => Promise<boolean>;
  uploadPolicyAccepted?: boolean;
}) {
  const { t } = useI18n("generate");
  const [modalError, setModalError] = useState<string | null>(null);
  const [zoomedItem, setZoomedItem] = useState<ZoomableItem | null>(null);
  const [editingItem, setEditingItem] = useState<EditableItem | null>(null);
  const [aliasInput, setAliasInput] = useState("");
  const [isSavingAlias, setIsSavingAlias] = useState(false);
  const [deletingItem, setDeletingItem] = useState<StudioUpload | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!opened) {
      setModalError(null);
    }
  }, [opened]);

  const effectiveTotal = Math.max(uploadTotal, uploads.length);
  const totalUploadPages = Math.max(1, Math.ceil(effectiveTotal / UPLOADS_PER_PAGE));
  const currentPage = Math.min(uploadPage, totalUploadPages);

  const imageGenerations = generations.filter((job) => isJobImage(job));
  const items = tab === "generations" ? imageGenerations : uploads;

  function handleToggleGeneration(job: JobView) {
    const selected = isSelected(job.id);
    if (!selected && selectedCount >= maxSelected) {
      setModalError(t("library_modal.max_selected_error", { max: maxSelected }));
      return;
    }
    setModalError(null);
    onToggleGeneration(job);
  }

  function handleToggleUpload(item: StudioUpload) {
    const selected = isSelected(item.id);
    if (!selected && selectedCount >= maxSelected) {
      setModalError(t("library_modal.max_selected_error", { max: maxSelected }));
      return;
    }
    setModalError(null);
    onToggleUpload(item);
  }

  function handleUploadClick() {
    if (selectedCount >= maxSelected) {
      setModalError(t("library_modal.max_selected_error", { max: maxSelected }));
      return;
    }
    setModalError(null);
    onUploadClick();
  }

  async function handleSaveAlias() {
    if (!editingItem || !onUpdateAlias) return;
    setIsSavingAlias(true);
    await onUpdateAlias(editingItem.id, aliasInput, editingItem.kind);
    setIsSavingAlias(false);
    setEditingItem(null);
  }

  async function handleConfirmDelete() {
    if (!deletingItem || !onDeleteUpload) return;
    setIsDeleting(true);
    await onDeleteUpload(deletingItem.id);
    setIsDeleting(false);
    setDeletingItem(null);
  }

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={
          <Group gap="xs" align="center">
            <Text fw={700} size="md">
              {t("library_modal.title")}
            </Text>
            <Badge size="sm" variant="light" color={selectedCount >= maxSelected ? "yellow" : "blue"}>
              {t("library_modal.selected_count", { count: selectedCount, max: maxSelected })}
            </Badge>
          </Group>
        }
        size="lg"
        centered
        radius="lg"
      >
        <Stack gap="sm">
          {/* Top Segmented Tabs Switcher (Generations vs Upload media) */}
          <div className={classes.libraryTabsRow}>
            <button
              type="button"
              className={`${classes.libraryTabBtn} ${tab === "generations" ? classes.libraryTabBtnActive : ""}`}
              onClick={() => onTab("generations")}
            >
              {t("library_modal.tab_generations")}
            </button>
            <button
              type="button"
              className={`${classes.libraryTabBtn} ${tab === "uploads" ? classes.libraryTabBtnActive : ""}`}
              onClick={() => onTab("uploads")}
            >
              {t("library_modal.tab_uploads")}
            </button>
          </div>

          {/* Section Header */}
          <div className={classes.librarySectionHeader}>
            <Text fw={700} size="md" c="white" ta="center" className={classes.librarySectionTitle}>
              {tab === "generations" ? t("library_modal.tab_generations") : t("library_modal.tab_uploads")}
            </Text>
            {tab === "uploads" ? (
              <Button
                type="button"
                size="xs"
                variant="light"
                color="blue"
                onClick={handleUploadClick}
                className={classes.libraryUploadActionBtn}
              >
                {t("library_modal.btn_upload")}
              </Button>
            ) : null}
          </div>

          {modalError ? (
            <Alert
              color="red"
              variant="light"
              radius="sm"
              withCloseButton
              onClose={() => setModalError(null)}
            >
              {modalError}
            </Alert>
          ) : null}

          {tab === "uploads" && !uploadPolicyAccepted ? (
            <Alert color="yellow" variant="light" radius="sm">
              <Group justify="space-between" align="center">
                <Text size="xs">
                  {t("library_modal.policy_required")}
                </Text>
                <Button size="compact-xs" color="yellow" variant="filled" onClick={handleUploadClick}>
                  {t("library_modal.policy_accept_now")}
                </Button>
              </Group>
            </Alert>
          ) : null}

          {/* Media Items Grid */}
          <div className={classes.libraryScrollArea}>
            {items.length === 0 ? (
              <Text c="dimmed" size="sm" ta="center" py="xl">
                {tab === "generations" ? t("library_modal.empty_generations") : t("library_modal.empty_uploads")}
              </Text>
            ) : tab === "generations" ? (
              <SimpleGrid cols={{ base: 2, sm: 2, md: 4 }} spacing="xs" className={classes.libraryGrid}>
                {imageGenerations.map((job) => {
                  const selected = isSelected(job.id);
                  const url = job.output?.url ?? "";
                  return (
                    <div key={job.id} className={classes.tileWrapper}>
                      <UnstyledButton
                        onClick={() => handleToggleGeneration(job)}
                        className={classes.tileButton}
                        aria-label={job.prompt}
                      >
                        <img
                          src={url}
                          alt={job.prompt}
                          className={selected ? classes.tileDimmed : undefined}
                        />
                        {selected ? (
                          <div className={classes.tileCheckOverlay}>
                            <div className={classes.tileCheckBadge}>
                              <CheckIcon size={14} />
                            </div>
                          </div>
                        ) : null}
                      </UnstyledButton>

                      {job.alias ? (
                        <div className={classes.tileAliasBadge}>
                          @{job.alias}
                        </div>
                      ) : null}

                      <div className={classes.tileActionsOverlay}>
                        <Tooltip label={t("library_modal.tooltip_zoom")} withArrow position="top">
                          <button
                            type="button"
                            className={classes.tileActionBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              setZoomedItem({
                                id: job.id,
                                url,
                                name: `Generation #${job.id.slice(0, 8)}`,
                                alias: job.alias,
                                width: job.output?.width,
                                height: job.output?.height,
                                kind: "generation",
                              });
                            }}
                            aria-label={t("library_modal.aria_zoom")}
                          >
                            <ZoomIcon size={13} />
                          </button>
                        </Tooltip>

                        <Tooltip label={t("library_modal.tooltip_edit_alias")} withArrow position="top">
                          <button
                            type="button"
                            className={classes.tileActionBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingItem({
                                id: job.id,
                                alias: job.alias ?? "",
                                kind: "generation",
                              });
                              setAliasInput(job.alias ?? "");
                            }}
                            aria-label={t("library_modal.aria_edit_alias")}
                          >
                            <PencilIcon size={13} />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </SimpleGrid>
            ) : (
              <>
                <SimpleGrid cols={{ base: 2, sm: 2, md: 4 }} spacing="xs" className={classes.libraryGrid}>
                  {uploads.map((item) => {
                    const selected = isSelected(item.id);
                    return (
                      <div key={item.id} className={classes.tileWrapper}>
                        <UnstyledButton
                          onClick={() => !item.uploading && handleToggleUpload(item)}
                          className={classes.tileButton}
                          aria-label={item.name}
                        >
                          <img
                            src={item.url}
                            alt={item.name}
                            className={`${item.uploading ? classes.tileBlur : ""} ${selected ? classes.tileDimmed : ""}`}
                          />
                          {selected && !item.uploading ? (
                            <div className={classes.tileCheckOverlay}>
                              <div className={classes.tileCheckBadge}>
                                <CheckIcon size={14} />
                              </div>
                            </div>
                          ) : null}
                          {item.uploading ? (
                            <div className={classes.tileProgressOverlay}>
                              <Progress
                                value={item.progress ?? 0}
                                size="sm"
                                radius="xl"
                                color="blue"
                                animated
                                className={classes.tileProgressBar}
                              />
                              <Text className={classes.tileProgressText}>
                                {item.progress ?? 0}%
                              </Text>
                            </div>
                          ) : null}
                        </UnstyledButton>

                        {item.alias ? (
                          <div className={classes.tileAliasBadge}>
                            @{item.alias}
                          </div>
                        ) : null}

                        {!item.uploading ? (
                          <div className={classes.tileActionsOverlay}>
                            <Tooltip label={t("library_modal.tooltip_zoom")} withArrow position="top">
                              <button
                                type="button"
                                className={classes.tileActionBtn}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setZoomedItem({
                                    id: item.id,
                                    url: item.url,
                                    name: item.name,
                                    alias: item.alias,
                                    width: item.width,
                                    height: item.height,
                                    kind: "upload",
                                  });
                                }}
                                aria-label={t("library_modal.aria_zoom")}
                              >
                                <ZoomIcon size={13} />
                              </button>
                            </Tooltip>

                            <Tooltip label={t("library_modal.tooltip_edit_alias")} withArrow position="top">
                              <button
                                type="button"
                                className={classes.tileActionBtn}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingItem({
                                    id: item.id,
                                    alias: item.alias ?? "",
                                    kind: "upload",
                                  });
                                  setAliasInput(item.alias ?? "");
                                }}
                                aria-label={t("library_modal.aria_edit_alias")}
                              >
                                <PencilIcon size={13} />
                              </button>
                            </Tooltip>

                            <Tooltip label={t("library_modal.tooltip_delete")} withArrow position="top">
                              <button
                                type="button"
                                className={`${classes.tileActionBtn} ${classes.tileActionBtnDanger}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingItem(item);
                                }}
                                aria-label={t("library_modal.aria_delete")}
                              >
                                <TrashIcon size={13} />
                              </button>
                            </Tooltip>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </SimpleGrid>

                {totalUploadPages > 1 ? (
                  <div className={classes.paginationWrapper}>
                    <Pagination
                      value={currentPage}
                      onChange={(p) => onUploadPageChange?.(p)}
                      total={totalUploadPages}
                      size="sm"
                    />
                  </div>
                ) : null}
              </>
            )}
          </div>
        </Stack>
      </Modal>

      {/* Modal Zoom Gambar Dimensi Sesungguhnya */}
      <Modal
        opened={Boolean(zoomedItem)}
        onClose={() => setZoomedItem(null)}
        title={
          zoomedItem?.alias
            ? t("library_modal.preview_alias_title", { alias: zoomedItem.alias })
            : zoomedItem?.name ?? t("library_modal.preview_title")
        }
        size="lg"
        centered
      >
        {zoomedItem ? (
          <Stack gap="sm">
            <div className={classes.zoomImageContainer}>
              <img
                src={zoomedItem.url}
                alt={zoomedItem.name}
                className={classes.zoomImage}
              />
            </div>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                {zoomedItem.width && zoomedItem.height
                  ? `${zoomedItem.width} × ${zoomedItem.height} px`
                  : t("library_modal.native_dimension")}
              </Text>
              {zoomedItem.alias ? (
                <Text size="xs" c="green" fw={600}>
                  {t("library_modal.alias_label", { alias: zoomedItem.alias })}
                </Text>
              ) : null}
            </Group>
          </Stack>
        ) : null}
      </Modal>

      {/* Modal Ubah Alias */}
      <Modal
        opened={Boolean(editingItem)}
        onClose={() => !isSavingAlias && setEditingItem(null)}
        title={t("library_modal.edit_alias_title")}
        size="sm"
        centered
      >
        {editingItem ? (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {t("library_modal.edit_alias_desc", { alias: aliasInput.trim() || "nama_alias" })}
            </Text>
            <TextInput
              label={t("library_modal.alias_field_label")}
              placeholder={t("library_modal.alias_field_placeholder")}
              value={aliasInput}
              onChange={(e) => setAliasInput(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSaveAlias();
                }
              }}
              autoFocus
            />
            <Group justify="flex-end" gap="xs">
              <Button
                variant="subtle"
                onClick={() => setEditingItem(null)}
                disabled={isSavingAlias}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => void handleSaveAlias()}
                loading={isSavingAlias}
              >
                {t("common.save")}
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>

      {/* Modal Konfirmasi Hapus */}
      <Modal
        opened={Boolean(deletingItem)}
        onClose={() => !isDeleting && setDeletingItem(null)}
        title={t("library_modal.delete_title")}
        size="sm"
        centered
      >
        {deletingItem ? (
          <Stack gap="md">
            <Text size="sm">
              {t("library_modal.delete_desc")}
            </Text>
            <Group justify="flex-end" gap="xs">
              <Button
                variant="subtle"
                onClick={() => setDeletingItem(null)}
                disabled={isDeleting}
              >
                {t("common.cancel")}
              </Button>
              <Button
                color="red"
                onClick={() => void handleConfirmDelete()}
                loading={isDeleting}
              >
                {t("common.delete")}
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </>
  );
}
