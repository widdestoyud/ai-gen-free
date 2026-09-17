"use client";

import {
  ActionIcon,
  Badge,
  Button,
  CopyButton,
  Group,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { useEffect, useState } from "react";
import type { LibraryItem } from "@/hooks/use-library";
import { formatBytes, resolveUploadUrl } from "@/lib/format";
import { extractReferenceImages, type ReferenceImageItem } from "@/lib/job-status";
import { downloadMediaFile } from "@/lib/download-media";
import { useImageViewer } from "@/hooks/use-image-viewer";
import classes from "./media-detail-modal.module.css";

function DownloadIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
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

function ZoomInIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function ZoomOutIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function ZoomResetIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function CopyIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ChevronLeftIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function TrashIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function formatModalDate(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const day = d.getDate();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const month = monthNames[d.getMonth()] || "";
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hours}.${mins}`;
}

function formatModalDateShort(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const day = d.getDate();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const month = monthNames[d.getMonth()] || "";
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function getModeLabel(item: LibraryItem): string {
  if (item.type === "upload") return "UPLOAD MEDIA";
  if (item.kind === "video") return "GENERATED VIDEO";
  return "GENERATED IMAGE";
}

function getStatusLabel(item: LibraryItem): string {
  if (item.type === "upload") return "READY";
  if (item.status === "succeeded") return "COMPLETED";
  return item.status.toUpperCase();
}

export function MediaDetailModal({
  opened,
  onClose,
  item,
  items,
  onSelectItem,
  onDeleteUpload,
}: {
  opened: boolean;
  onClose: () => void;
  item: LibraryItem | null;
  items: LibraryItem[];
  onSelectItem: (item: LibraryItem) => void;
  onDeleteUpload?: (id: string) => Promise<boolean>;
}) {
  const [previewRef, setPreviewRef] = useState<ReferenceImageItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const viewer = useImageViewer({ resetKey: `${item?.id}-${opened}` });

  const currentIndex = items.findIndex((i) => i.id === item?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < items.length - 1;

  useEffect(() => {
    setConfirmDelete(false);
  }, [item?.id, opened]);

  useEffect(() => {
    if (!opened) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" && hasPrev) {
        onSelectItem(items[currentIndex - 1]!);
      } else if (e.key === "ArrowRight" && hasNext) {
        onSelectItem(items[currentIndex + 1]!);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [opened, currentIndex, hasPrev, hasNext, items, onSelectItem]);

  if (!item) return null;

  const handleModalClose = () => {
    setPreviewRef(null);
    setConfirmDelete(false);
    viewer.resetZoom();
    onClose();
  };

  const handleDeleteUpload = async () => {
    if (!item || !onDeleteUpload) return;
    setIsDeleting(true);
    try {
      const ok = await onDeleteUpload(item.id);
      if (ok) {
        handleModalClose();
      }
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  const isVideo = item.kind === "video" || item.mime_type.startsWith("video/");
  const isGenerated = item.type === "generated";
  const displayLabel = item.prompt || item.alias || item.id;

  const handleDownload = async () => {
    if (!item?.url) return;
    setIsDownloading(true);
    try {
      const rawFilename = item.type === "upload" ? (item.alias || `upload-${item.id}`) : `media-${item.id}`;
      await downloadMediaFile({
        url: item.url,
        filename: rawFilename,
        isVideo,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={handleModalClose}
        size="960px"
        centered
        classNames={{
          content: classes.modalContentFull,
          body: classes.modalBodyNoPadding,
          header: classes.modalHeaderClean,
        }}
      >
        <div className={classes.detailModalLayout}>
          {/* Kolom Kiri: Media Showcase */}
          <div className={classes.mediaShowcaseSection}>
            <div
              ref={viewer.containerRef}
              className={classes.mediaViewerWrapper}
              data-zoomed={viewer.isZoomed ? "true" : undefined}
              data-dragging={viewer.isDragging ? "true" : undefined}
              {...(!isVideo ? viewer.viewerProps : {})}
            >
              {isVideo ? (
                <video
                  src={item.url ?? ""}
                  controls
                  autoPlay
                  loop
                  className={classes.detailMedia}
                />
              ) : (
                <img
                  ref={viewer.imageRef}
                  src={item.url ?? ""}
                  alt={displayLabel}
                  className={classes.detailMedia}
                />
              )}

              {/* Tombol Navigasi Prev / Next */}
              {hasPrev ? (
                <button
                  type="button"
                  className={classes.navArrowLeft}
                  onClick={() => onSelectItem(items[currentIndex - 1]!)}
                  aria-label="Media Sebelumnya"
                >
                  <ChevronLeftIcon size={18} />
                </button>
              ) : null}

              {hasNext ? (
                <button
                  type="button"
                  className={classes.navArrowRight}
                  onClick={() => onSelectItem(items[currentIndex + 1]!)}
                  aria-label="Media Selanjutnya"
                >
                  <ChevronRightIcon size={18} />
                </button>
              ) : null}
            </div>

            {/* Kontrol Zoom (Hanya untuk Gambar) */}
            {!isVideo && item.url ? (
              <div className={classes.zoomControlsBar}>
                <Tooltip label="Perkecil (-)" withArrow position="top">
                  <button
                    type="button"
                    onClick={viewer.zoomOut}
                    disabled={!viewer.canZoomOut}
                    className={classes.zoomBtn}
                    aria-label="Zoom Out"
                  >
                    <ZoomOutIcon size={15} />
                  </button>
                </Tooltip>
                <span className={classes.zoomPercent}>{viewer.zoomLevel}%</span>
                <Tooltip label="Perbesar (+)" withArrow position="top">
                  <button
                    type="button"
                    onClick={viewer.zoomIn}
                    disabled={!viewer.canZoomIn}
                    className={classes.zoomBtn}
                    aria-label="Zoom In"
                  >
                    <ZoomInIcon size={15} />
                  </button>
                </Tooltip>
                {viewer.isZoomed ? (
                  <Tooltip label="Reset Ukuran" withArrow position="top">
                    <button
                      type="button"
                      onClick={viewer.resetZoom}
                      className={classes.zoomBtn}
                      aria-label="Reset Zoom"
                    >
                      <ZoomResetIcon size={13} />
                    </button>
                  </Tooltip>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Kolom Kanan: Detail & Aksi Media */}
          <div className={classes.detailInfoSidebar}>
            <ScrollArea type="hover" className={classes.sidebarScroll}>
              <div className={classes.sidebarContent}>
                {/* Status & Mode Badges */}
                <div className={classes.badgesRow}>
                  <Badge className={classes.modeBadge}>
                    {getModeLabel(item)}
                  </Badge>
                  <Badge className={classes.statusBadge}>
                    {getStatusLabel(item)}
                  </Badge>
                </div>

                {/* Tombol Aksi (Download & Delete) */}
                {item.url ? (
                  <Button
                    onClick={() => void handleDownload()}
                    loading={isDownloading}
                    variant="filled"
                    fullWidth
                    leftSection={<DownloadIcon size={16} />}
                    className={classes.primaryDownloadBtn}
                  >
                    Download
                  </Button>
                ) : null}

                {item.type === "upload" && onDeleteUpload ? (
                  confirmDelete ? (
                    <Group gap="xs" grow>
                      <Button
                        variant="filled"
                        color="red"
                        size="sm"
                        loading={isDeleting}
                        onClick={() => void handleDeleteUpload()}
                      >
                        Ya, Hapus
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        disabled={isDeleting}
                        onClick={() => setConfirmDelete(false)}
                      >
                        Batal
                      </Button>
                    </Group>
                  ) : (
                    <Button
                      variant="light"
                      color="red"
                      fullWidth
                      leftSection={<TrashIcon size={16} />}
                      className={classes.dangerDeleteBtn}
                      onClick={() => setConfirmDelete(true)}
                    >
                      Hapus Berkas
                    </Button>
                  )
                ) : null}

                {/* Reference Images (@image) */}
                {(() => {
                  const referenceImages = extractReferenceImages(item.params, item.prompt ?? undefined);
                  if (referenceImages.length === 0) return null;
                  return (
                    <div className={classes.referenceImagesSection}>
                      <div className={classes.referenceHeader}>
                        <span className={classes.promptHeading}>
                          REFERENCE IMAGE{referenceImages.length > 1 ? "S" : ""}
                        </span>
                      </div>
                      <div className={classes.referenceGrid}>
                        {referenceImages.map((ref, idx) => {
                          const imgUrl = resolveUploadUrl(ref.url);
                          return (
                            <Tooltip key={idx} label={`Lihat referensi: ${ref.tag}`} withArrow position="top">
                              <button
                                type="button"
                                onClick={() => setPreviewRef(ref)}
                                className={classes.referenceCard}
                                aria-label={`Lihat media referensi ${ref.tag}`}
                              >
                                <img
                                  src={imgUrl}
                                  alt={ref.tag}
                                  className={classes.referenceThumb}
                                />
                                <div className={classes.referenceTagBadge}>
                                  {ref.tag}
                                </div>
                              </button>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

              {/* Box Prompt (Hanya untuk Generated Media yang memiliki Prompt) */}
              {isGenerated && item.prompt ? (
                <div className={classes.promptSection}>
                  <div className={classes.promptHeader}>
                    <span className={classes.promptHeading}>PROMPT</span>
                    <CopyButton value={item.prompt} timeout={2000}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? "Tersalin" : "Salin teks"} withArrow position="left">
                          <ActionIcon
                            variant="subtle"
                            color={copied ? "teal" : "gray"}
                            size="xs"
                            onClick={copy}
                            aria-label="Salin teks prompt"
                          >
                            {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                  </div>
                  <div className={classes.promptParagraph}>
                    {item.prompt}
                  </div>
                </div>
              ) : null}

              {/* Spesifikasi & Metadata Gambar */}
              <div className={classes.metaProperties}>
                {isGenerated && typeof item.cost === "number" ? (
                  <div className={classes.metaRow}>
                    <span className={classes.metaLabel}>Biaya</span>
                    <span className={classes.metaValueBold}>{item.cost} Poin</span>
                  </div>
                ) : null}

                {item.width && item.height ? (
                  <div className={classes.metaRow}>
                    <span className={classes.metaLabel}>Dimensi</span>
                    <span className={classes.metaValue}>
                      {item.width} × {item.height} px
                    </span>
                  </div>
                ) : null}

                {item.size_bytes ? (
                  <div className={classes.metaRow}>
                    <span className={classes.metaLabel}>Ukuran Berkas</span>
                    <span className={classes.metaValue}>
                      {formatBytes(item.size_bytes)}
                    </span>
                  </div>
                ) : null}

                {item.created_at ? (
                  <div className={classes.metaRow}>
                    <span className={classes.metaLabel}>Dibuat</span>
                    <span className={classes.metaValue}>
                      {formatModalDate(item.created_at)}
                    </span>
                  </div>
                ) : null}

                {item.expires_at ? (
                  <div className={classes.metaRow}>
                    <span className={classes.metaLabel}>Masa Berlaku</span>
                    <span className={classes.metaValue}>
                      {formatModalDateShort(item.expires_at)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </ScrollArea>

          {/* Footer ID */}
          <div className={classes.sidebarFooter}>
            <span className={classes.footerIdText}>
              ID: {item.id}
            </span>
            <CopyButton value={item.id} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? "ID Tersalin" : "Salin ID"} withArrow position="left">
                  <ActionIcon
                    variant="subtle"
                    color={copied ? "teal" : "gray"}
                    size="xs"
                    onClick={copy}
                    aria-label="Salin ID"
                  >
                    {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </div>
        </div>
      </div>
    </Modal>

    {/* Modal Detail Media Referensi saat diklik */}
    <Modal
      opened={Boolean(previewRef)}
      onClose={() => setPreviewRef(null)}
      title="Detail Media Referensi"
      size="lg"
      centered
      zIndex={300}
    >
      {previewRef ? (
        <Stack gap="md">
          <div className={classes.zoomImageContainer}>
            <img
              src={resolveUploadUrl(previewRef.url)}
              alt={previewRef.tag}
              className={classes.zoomImage}
            />
          </div>

          <Paper p="sm" withBorder radius="md">
            <Group justify="space-between" wrap="wrap" gap="sm">
              <div>
                <Text size="xs" c="dimmed">
                  Tag Referensi
                </Text>
                <Group gap={6} mt={2}>
                  <Badge size="sm" variant="light" color="green">
                    {previewRef.tag}
                  </Badge>
                </Group>
              </div>

              <div>
                <Text size="xs" c="dimmed">
                  Tipe
                </Text>
                <Text size="sm" fw={600}>
                  Gambar (Image)
                </Text>
              </div>
            </Group>
          </Paper>

          <Group justify="flex-end" align="center">
            <Button
              variant="default"
              size="xs"
              onClick={() => setPreviewRef(null)}
            >
              Tutup
            </Button>
          </Group>
        </Stack>
      ) : null}
    </Modal>
  </>
  );
}
