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
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type LibraryItem, isUpscaledImage } from "@/hooks/use-library";
import { formatBytes, resolveUploadUrl } from "@/lib/format";
import { extractReferenceImages, type ReferenceImageItem } from "@/lib/job-status";
import { downloadMediaFile } from "@/lib/download-media";
import { useImageViewer } from "@/hooks/use-image-viewer";
import { SparkleIcon } from "./library-icons";
import { requestJson } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { ErrorAlert } from "@/components/error-alert";
import { ImageCompareSlider } from "./image-compare-slider";
import classes from "./media-detail-modal.module.css";

function EditPencilIcon({ size = 14 }: { size?: number }) {
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
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function BrushIcon({ size = 14 }: { size?: number }) {
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
      <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
      <path d="M7.07 14.94c-1.66 0-3 1.34-3 3 0 .83.34 1.58.88 2.12C5.5 20.62 6.25 21 7.07 21c1.66 0 3-1.34 3-3 0-.82-.34-1.57-.88-2.11" />
    </svg>
  );
}

function SplitIcon({ size = 14 }: { size?: number }) {
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
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="12" y1="3" x2="12" y2="21" />
    </svg>
  );
}

function SingleImageIcon({ size = 14 }: { size?: number }) {
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
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

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
  if (isUpscaledImage(item)) return "UPSCALE IMAGE";
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
  onUpscaleSuccess,
  onOpenInpaint,
}: {
  opened: boolean;
  onClose: () => void;
  item: LibraryItem | null;
  items: LibraryItem[];
  onSelectItem: (item: LibraryItem) => void;
  onDeleteUpload?: (id: string) => Promise<boolean>;
  onUpscaleSuccess?: () => void;
  onOpenInpaint?: (item: LibraryItem) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [previewRef, setPreviewRef] = useState<ReferenceImageItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [confirmUpscale, setConfirmUpscale] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [upscaleError, setUpscaleError] = useState<string | null>(null);
  const [upscaleSuccessMsg, setUpscaleSuccessMsg] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"compare" | "single">("compare");
  const viewer = useImageViewer({ resetKey: `${item?.id}-${opened}` });

  const currentIndex = items.findIndex((i) => i.id === item?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < items.length - 1;

  useEffect(() => {
    setViewMode("compare");
  }, [item?.id]);

  useEffect(() => {
    setConfirmDelete(false);
    setConfirmUpscale(false);
    setUpscaleError(null);
    setUpscaleSuccessMsg(null);
  }, [item?.id, opened]);

  const { data: catalogData } = useQuery<{ models?: Array<{ modelId: string; costPoints: number }> }>({
    queryKey: ["catalog-generate"],
    queryFn: async () => {
      const res = await requestJson<{ models?: Array<{ modelId: string; costPoints: number }> }>("/api/catalog/generate");
      return res.ok && res.data ? res.data : { models: [] };
    },
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
  });

  const upscaleModel = catalogData?.models?.find(
    (m) => m.modelId === "image-upscale" || m.modelId.toLowerCase().includes("upscale")
  );
  const upscaleEnabled = Boolean(upscaleModel);
  const upscaleCost = typeof upscaleModel?.costPoints === "number" ? upscaleModel.costPoints : 5;

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
  const isUpscaled = isUpscaledImage(item);
  const cleanAlias = item.alias ? item.alias.replace(/\.[^/.]+$/, "") : "";
  const displayLabel = item.type === "upload" ? (cleanAlias || item.id) : (item.prompt || cleanAlias || (isUpscaled ? "Upscaled Image" : item.id));

  const referenceImages = extractReferenceImages(item.params, item.prompt ?? undefined);
  const originalImageUrl = isUpscaled && referenceImages.length > 0 ? resolveUploadUrl(referenceImages[0].url) : null;
  const isCompareAvailable = Boolean(isUpscaled && originalImageUrl && item.url);

  const handleDownload = async () => {
    if (!item?.url) return;
    setIsDownloading(true);
    try {
      const rawFilename = item.type === "upload" ? (cleanAlias || `upload-${item.id}`) : `media-${item.id}`;
      await downloadMediaFile({
        url: item.url,
        filename: rawFilename,
        isVideo,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUpscale = async () => {
    if (!item?.url) return;
    setIsUpscaling(true);
    setUpscaleError(null);
    setUpscaleSuccessMsg(null);
    try {
      const res = await requestJson<{ id?: string; job_id?: string }>("/api/generate", {
        method: "POST",
        headers: {
          "Idempotency-Key":
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `upscale-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
        },
        body: JSON.stringify({
          mode: "i2i",
          modelId: "image-upscale",
          prompt: "",
          params: {
            image: item.url,
            upscale_mode: "factor",
            upscale_factor: 4.0,
          },
        }),
      });
      if (!res.ok) {
        setUpscaleError(res.message || "Gagal memulai proses upscale");
        return;
      }
      const newJobId = res.data?.id || res.data?.job_id;
      setConfirmUpscale(false);
      handleModalClose();
      onUpscaleSuccess?.();
      void queryClient.invalidateQueries({ queryKey: queryKeys.generatedJobs() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.library() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet() });
      if (newJobId) {
        router.push(`/app/generate?jobId=${encodeURIComponent(newJobId)}`);
      } else {
        router.push("/app/generate");
      }
      router.refresh();
    } catch (err) {
      setUpscaleError(err instanceof Error ? err.message : "Terjadi kesalahan saat memulai upscale");
    } finally {
      setIsUpscaling(false);
    }
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={handleModalClose}
        size="1040px"
        centered
        padding={0}
        classNames={{
          root: classes.modalRoot,
          inner: classes.modalInner,
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
              data-zoomed={!isCompareAvailable || viewMode === "single" ? (viewer.isZoomed ? "true" : undefined) : undefined}
              data-dragging={!isCompareAvailable || viewMode === "single" ? (viewer.isDragging ? "true" : undefined) : undefined}
              {...(!isVideo && (!isCompareAvailable || viewMode === "single") ? viewer.viewerProps : {})}
            >
              {isVideo ? (
                <video
                  src={resolveUploadUrl(item.url)}
                  controls
                  autoPlay
                  loop
                  className={classes.detailMedia}
                />
              ) : isCompareAvailable && viewMode === "compare" && originalImageUrl ? (
                <ImageCompareSlider
                  beforeUrl={originalImageUrl}
                  afterUrl={resolveUploadUrl(item.url)}
                  beforeLabel="Sebelum (Original)"
                  afterLabel="Sesudah (4x Upscale)"
                />
              ) : (
                <img
                  ref={viewer.imageRef}
                  src={resolveUploadUrl(item.url)}
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

            {/* Kontrol Zoom & View Mode Switcher (Hanya untuk Gambar) */}
            {!isVideo && item.url ? (
              <div className={classes.zoomControlsBar}>
                {isCompareAvailable ? (
                  <div className={classes.viewModeToggle}>
                    <Tooltip label="Bandingkan Before & After (Geser Garis)" withArrow position="top">
                      <button
                        type="button"
                        className={`${classes.viewModeBtn} ${viewMode === "compare" ? classes.viewModeBtnActive : ""}`}
                        onClick={() => setViewMode("compare")}
                        aria-label="Mode Pembanding"
                      >
                        <SplitIcon size={13} />
                        <span>Bandingkan</span>
                      </button>
                    </Tooltip>
                    <Tooltip label="Mode Zoom & Pan Gambar Tunggal" withArrow position="top">
                      <button
                        type="button"
                        className={`${classes.viewModeBtn} ${viewMode === "single" ? classes.viewModeBtnActive : ""}`}
                        onClick={() => setViewMode("single")}
                        aria-label="Mode Gambar Tunggal"
                      >
                        <SingleImageIcon size={13} />
                        <span>Detail</span>
                      </button>
                    </Tooltip>
                  </div>
                ) : null}

                {!isCompareAvailable || viewMode === "single" ? (
                  <>
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
                  </>
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
                  <Badge className={isUpscaled ? classes.modeBadgeUpscale : classes.modeBadge}>
                    {getModeLabel(item)}
                  </Badge>
                  <Badge className={classes.statusBadge}>
                    {getStatusLabel(item)}
                  </Badge>
                </div>

                {/* Tombol Aksi (Download full width, Edit & Upscale side by side, & Delete) */}
                {item.url ? (
                  !isVideo ? (
                    <div className={classes.actionButtonsContainer}>
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
                      <div className={classes.actionButtonsRow}>
                        <Button
                          onClick={() => {
                            if (onOpenInpaint && item) {
                              onOpenInpaint(item);
                            }
                            onClose();
                          }}
                          variant="filled"
                          leftSection={<EditPencilIcon size={14} />}
                          className={classes.inpaintEditBtn}
                        >
                          Edit
                        </Button>
                        {!isUpscaled && upscaleEnabled ? (
                          <Button
                            onClick={() => {
                              setUpscaleError(null);
                              setConfirmUpscale(true);
                            }}
                            loading={isUpscaling}
                            variant="filled"
                            leftSection={<SparkleIcon size={13} />}
                            className={classes.upscaleBtn}
                          >
                            Upscale
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className={classes.actionButtonsContainer}>
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
                    </div>
                  )
                ) : null}

                {upscaleError ? <ErrorAlert message={upscaleError} /> : null}

                {upscaleSuccessMsg ? (
                  <Paper
                    p="xs"
                    radius="md"
                    style={{
                      background: "rgba(34, 197, 94, 0.15)",
                      border: "1px solid rgba(34, 197, 94, 0.3)",
                    }}
                  >
                    <Text size="xs" c="green.3" fw={500}>
                      {upscaleSuccessMsg}
                    </Text>
                  </Paper>
                ) : null}

                {item.type === "upload" && onDeleteUpload ? (
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
                ) : null}

                {/* Reference Images (@image / Original Image) */}
                {(() => {
                  const referenceImages = extractReferenceImages(item.params, item.prompt ?? undefined);
                  if (referenceImages.length === 0) return null;
                  return (
                    <div className={classes.referenceImagesSection}>
                      <div className={classes.referenceHeader}>
                        <span className={classes.promptHeading}>
                          {isUpscaled
                            ? "REFERENSI GAMBAR ASLI"
                            : `REFERENCE IMAGE${referenceImages.length > 1 ? "S" : ""}`}
                        </span>
                      </div>
                      <div className={classes.referenceGrid}>
                        {referenceImages.map((ref, idx) => {
                          const imgUrl = resolveUploadUrl(ref.url);
                          const tagLabel = isUpscaled ? "Original" : ref.tag;
                          return (
                            <Tooltip
                              key={idx}
                              label={isUpscaled ? "Lihat gambar asli sebelum di-upscale" : `Lihat referensi: ${ref.tag}`}
                              withArrow
                              position="top"
                            >
                              <button
                                type="button"
                                onClick={() => setPreviewRef({ ...ref, tag: tagLabel })}
                                className={classes.referenceCard}
                                aria-label={isUpscaled ? "Lihat gambar asli" : `Lihat media referensi ${tagLabel}`}
                              >
                                <img
                                  src={imgUrl}
                                  alt={tagLabel}
                                  className={classes.referenceThumb}
                                />
                                <div className={classes.referenceTagBadge}>
                                  {tagLabel}
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

              {/* Box Nama Berkas (Hanya untuk Uploaded Media) */}
              {item.type === "upload" && (cleanAlias || item.id) ? (
                <div className={classes.promptSection}>
                  <div className={classes.promptHeader}>
                    <span className={classes.promptHeading}>NAMA BERKAS</span>
                    <CopyButton value={cleanAlias || item.id} timeout={2000}>
                      {({ copied, copy }) => (
                        <Tooltip label={copied ? "Tersalin" : "Salin nama berkas"} withArrow position="left">
                          <ActionIcon
                            variant="subtle"
                            color={copied ? "teal" : "gray"}
                            size="xs"
                            onClick={copy}
                            aria-label="Salin nama berkas"
                          >
                            {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </CopyButton>
                  </div>
                  <div className={classes.promptParagraph}>
                    {cleanAlias || item.id}
                  </div>
                </div>
              ) : null}

              {/* Spesifikasi & Metadata Gambar */}
              <div className={classes.metaProperties}>
                {isGenerated && typeof item.cost === "number" ? (
                  <div className={classes.metaRow}>
                    <span className={classes.metaLabel}>Biaya</span>
                    <span className={classes.metaValueBold}>{item.cost} Sparks</span>
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
      title={isUpscaled ? "Detail Gambar Asli (Sebelum Upscale)" : "Detail Media Referensi"}
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
                  {isUpscaled ? "Keterangan" : "Tag Referensi"}
                </Text>
                <Group gap={6} mt={2}>
                  <Badge size="sm" variant="light" color={isUpscaled ? "violet" : "green"}>
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

    {/* Modal Konfirmasi Upscale */}
    <Modal
      opened={confirmUpscale}
      onClose={() => {
        if (!isUpscaling) setConfirmUpscale(false);
      }}
      title="Tingkatkan Resolusi Gambar (Upscale)"
      size="md"
      centered
      zIndex={350}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Tingkatkan kualitas dan ketajaman gambar hingga 4x lipat lebih tinggi menggunakan AI Image Upscaler.
        </Text>

        <Paper p="sm" withBorder radius="md" bg="rgba(255, 255, 255, 0.03)">
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed">
                Biaya Poin
              </Text>
              <Text size="sm" fw={600}>
                Layanan AI Upscale
              </Text>
            </div>
            <Badge color="violet" size="lg" variant="light" leftSection={<SparkleIcon size={12} />}>
              {upscaleCost} Sparks
            </Badge>
          </Group>
        </Paper>

        {upscaleError ? <ErrorAlert message={upscaleError} /> : null}

        <Group justify="flex-end" gap="xs" mt="xs">
          <Button
            variant="default"
            size="sm"
            disabled={isUpscaling}
            onClick={() => setConfirmUpscale(false)}
          >
            Batal
          </Button>
          <Button
            className={classes.upscaleBtn}
            size="sm"
            loading={isUpscaling}
            leftSection={<SparkleIcon size={14} />}
            onClick={() => void handleUpscale()}
          >
            Mulai Upscale
          </Button>
        </Group>
      </Stack>
    </Modal>

    {/* Modal Konfirmasi Hapus Berkas */}
    <Modal
      opened={confirmDelete}
      onClose={() => {
        if (!isDeleting) setConfirmDelete(false);
      }}
      title="Hapus Berkas Media"
      size="sm"
      centered
      zIndex={360}
    >
      <Stack gap="md">
        <Text size="sm">
          Apakah Anda yakin ingin menghapus berkas <strong>{displayLabel}</strong>? Tindakan ini permanen dan tidak dapat dibatalkan.
        </Text>

        <Group justify="flex-end" gap="xs" mt="xs">
          <Button
            variant="default"
            size="sm"
            disabled={isDeleting}
            onClick={() => setConfirmDelete(false)}
          >
            Batal
          </Button>
          <Button
            color="red"
            variant="filled"
            size="sm"
            loading={isDeleting}
            leftSection={<TrashIcon size={14} />}
            onClick={() => void handleDeleteUpload()}
          >
            Ya, Hapus
          </Button>
        </Group>
      </Stack>
    </Modal>
  </>
  );
}
