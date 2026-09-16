"use client";

import { useState } from "react";
import {
  Button,
  Group,
  Modal,
  NavLink,
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
import type { JobView } from "@/lib/job-status";
import type { StudioUpload } from "@/hooks/use-generate-studio";
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
  onToggleGeneration,
  onToggleUpload,
  onUploadClick,
  onDeleteUpload,
  onUpdateAlias,
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
  onToggleGeneration: (job: JobView) => void;
  onToggleUpload: (item: StudioUpload) => void;
  onUploadClick: () => void;
  onDeleteUpload?: (id: string) => Promise<boolean>;
  onUpdateAlias?: (id: string, alias: string, kind?: "generation" | "upload") => Promise<boolean>;
}) {
  const [zoomedItem, setZoomedItem] = useState<ZoomableItem | null>(null);
  const [editingItem, setEditingItem] = useState<EditableItem | null>(null);
  const [aliasInput, setAliasInput] = useState("");
  const [isSavingAlias, setIsSavingAlias] = useState(false);
  const [deletingItem, setDeletingItem] = useState<StudioUpload | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const effectiveTotal = Math.max(uploadTotal, uploads.length);
  const totalUploadPages = Math.max(1, Math.ceil(effectiveTotal / UPLOADS_PER_PAGE));
  const currentPage = Math.min(uploadPage, totalUploadPages);

  const items = tab === "generations" ? generations : uploads;

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
      <Modal opened={opened} onClose={onClose} title="Pilih gambar" size="xl" centered>
        <Group align="flex-start" gap="lg" wrap="nowrap">
          <Stack gap={4} className={classes.libraryNav}>
            <NavLink
              label="Generations"
              active={tab === "generations"}
              onClick={() => onTab("generations")}
            />
            <NavLink
              label="Upload media"
              active={tab === "uploads"}
              onClick={() => onTab("uploads")}
            />
          </Stack>
          <Stack gap="sm" className={classes.libraryMain}>
            <Group justify="space-between">
              <Text fw={600}>{tab === "generations" ? "Generations" : "Upload media"}</Text>
              {tab === "uploads" ? (
                <Button type="button" size="xs" onClick={onUploadClick}>
                  + Upload
                </Button>
              ) : null}
            </Group>
            {items.length === 0 ? (
              <Text c="dimmed" size="sm">
                {tab === "generations" ? "Belum ada hasil generate." : "Belum ada unggahan."}
              </Text>
            ) : tab === "generations" ? (
              <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="xs" className={classes.libraryGrid}>
                {generations.map((job) => {
                  const selected = isSelected(job.id);
                  const url = job.output?.url ?? "";
                  return (
                    <div key={job.id} className={classes.tileWrapper}>
                      <UnstyledButton
                        onClick={() => onToggleGeneration(job)}
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
                        <Tooltip label="Perbesar" withArrow position="top">
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
                            aria-label="Perbesar gambar"
                          >
                            <ZoomIcon size={13} />
                          </button>
                        </Tooltip>

                        <Tooltip label="Ubah Alias (@)" withArrow position="top">
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
                            aria-label="Ubah alias gambar"
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
                <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="xs" className={classes.libraryGrid}>
                  {uploads.map((item) => {
                    const selected = isSelected(item.id);
                    return (
                      <div key={item.id} className={classes.tileWrapper}>
                        <UnstyledButton
                          onClick={() => !item.uploading && onToggleUpload(item)}
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
                            <Tooltip label="Perbesar" withArrow position="top">
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
                                aria-label="Perbesar gambar"
                              >
                                <ZoomIcon size={13} />
                              </button>
                            </Tooltip>

                            <Tooltip label="Ubah Alias (@)" withArrow position="top">
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
                                aria-label="Ubah alias gambar"
                              >
                                <PencilIcon size={13} />
                              </button>
                            </Tooltip>

                            <Tooltip label="Hapus" withArrow position="top">
                              <button
                                type="button"
                                className={`${classes.tileActionBtn} ${classes.tileActionBtnDanger}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingItem(item);
                                }}
                                aria-label="Hapus gambar"
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
          </Stack>
        </Group>
      </Modal>

      {/* Modal Zoom Gambar Dimensi Sesungguhnya */}
      <Modal
        opened={Boolean(zoomedItem)}
        onClose={() => setZoomedItem(null)}
        title={
          zoomedItem?.alias
            ? `@${zoomedItem.alias} — Pratinjau Gambar`
            : zoomedItem?.name ?? "Pratinjau Gambar"
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
                  : "Dimensi asli"}
              </Text>
              {zoomedItem.alias ? (
                <Text size="xs" c="green" fw={600}>
                  Alias: @{zoomedItem.alias}
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
        title="Ubah Alias Gambar"
        size="sm"
        centered
      >
        {editingItem ? (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Alias akan digunakan saat memanggil gambar dengan simbol <code>@</code> pada kolom prompt (contoh: <code>@{aliasInput.trim() || "nama_alias"}</code>).
            </Text>
            <TextInput
              label="Nama Alias"
              placeholder="contoh: kerenjaya"
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
                Batal
              </Button>
              <Button
                onClick={() => void handleSaveAlias()}
                loading={isSavingAlias}
              >
                Simpan
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>

      {/* Modal Konfirmasi Hapus */}
      <Modal
        opened={Boolean(deletingItem)}
        onClose={() => !isDeleting && setDeletingItem(null)}
        title="Hapus Gambar Unggahan"
        size="sm"
        centered
      >
        {deletingItem ? (
          <Stack gap="md">
            <Text size="sm">
              Apakah Anda yakin ingin menghapus gambar ini? Gambar yang telah dihapus tidak dapat dipulihkan.
            </Text>
            <Group justify="flex-end" gap="xs">
              <Button
                variant="subtle"
                onClick={() => setDeletingItem(null)}
                disabled={isDeleting}
              >
                Batal
              </Button>
              <Button
                color="red"
                onClick={() => void handleConfirmDelete()}
                loading={isDeleting}
              >
                Hapus
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </>
  );
}
