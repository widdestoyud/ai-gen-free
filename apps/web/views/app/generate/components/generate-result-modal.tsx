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
import { extractReferenceImages, type JobView, type ReferenceImageItem } from "@/lib/job-status";
import { resolveUploadUrl } from "@/lib/format";
import { downloadMediaFile } from "@/lib/download-media";
import { useImageViewer } from "@/hooks/use-image-viewer";
import classes from "./generate-result-modal.module.css";

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

function CopyIcon({ size = 15 }: { size?: number }) {
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

function CheckIcon({ size = 15 }: { size?: number }) {
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

function formatModalDate(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const day = d.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const month = months[d.getMonth()] || "";
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
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const month = months[d.getMonth()] || "";
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatModeLabel(mode?: string): string {
  if (!mode) return "Generated Image";
  const m = mode.toLowerCase();
  if (m === "t2i" || m === "i2i") return "Generated Image";
  if (m === "t2v" || m === "i2v") return "Generated Video";
  return "Generated Image";
}

export function GenerateResultModal({
  opened,
  onClose,
  job,
}: {
  opened: boolean;
  onClose: () => void;
  job: JobView | null;
}) {
  const [previewRef, setPreviewRef] = useState<ReferenceImageItem | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const viewer = useImageViewer({ resetKey: `${job?.id}-${opened}` });

  if (!job) return null;

  const isVideo =
    job.mode?.includes("video") || job.output?.contentType.startsWith("video/");

  const handleModalClose = () => {
    setPreviewRef(null);
    viewer.resetZoom();
    onClose();
  };

  const handleDownload = async () => {
    if (!job.output?.url) return;
    setIsDownloading(true);
    try {
      await downloadMediaFile({
        url: job.output.url,
        filename: `ai-gen-${job.id}`,
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
        title="Hasil Generate"
        size="90%"
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
                  src={job.output?.url ?? ""}
                  controls
                  autoPlay
                  loop
                  className={classes.detailMedia}
                />
              ) : (
                <img
                  ref={viewer.imageRef}
                  src={job.output?.url ?? ""}
                  alt={job.prompt}
                  className={classes.detailMedia}
                />
              )}
            </div>

            {/* Kontrol Zoom (Hanya untuk Gambar) */}
            {!isVideo && job.output?.url ? (
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
              <Stack gap="md" p="md">
                {/* Status & Mode Badges */}
                <Group justify="space-between" align="center">
                  <Badge variant="light" color="blue" size="md" radius="sm">
                    {formatModeLabel(job.mode)}
                  </Badge>
                  <Badge variant="light" color="green" size="md" radius="sm">
                    Completed
                  </Badge>
                </Group>

                {/* Tombol Aksi Utama (Download) */}
                {job.output?.url ? (
                  <Button
                    onClick={() => void handleDownload()}
                    loading={isDownloading}
                    variant="filled"
                    color="dark.4"
                    size="md"
                    radius="md"
                    fullWidth
                    mt="xs"
                    leftSection={<DownloadIcon size={18} />}
                    className={classes.primaryDownloadBtn}
                  >
                    Download
                  </Button>
                ) : null}

                {/* Gambar Referensi (@image) */}
                {(() => {
                  const referenceImages = extractReferenceImages(job.params, job.prompt);
                  if (referenceImages.length === 0) return null;
                  return (
                    <div className={classes.referenceImagesSection}>
                      <Text size="sm" fw={700} c="dimmed" tt="uppercase" lts={0.5} mb={8}>
                        Reference Image{referenceImages.length > 1 ? "s" : ""}
                      </Text>
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

              {/* Box Prompt */}
              <div className={classes.promptSection}>
                <Group justify="space-between" align="center" mb={6}>
                  <Text size="sm" fw={700} c="dimmed" tt="uppercase" lts={0.5}>
                    prompt
                  </Text>
                  <CopyButton value={job.prompt} timeout={2000}>
                    {({ copied, copy }) => (
                      <Tooltip label={copied ? "Tersalin" : "Salin prompt"} withArrow position="left">
                        <ActionIcon
                          variant="subtle"
                          color={copied ? "teal" : "gray"}
                          size="sm"
                          onClick={copy}
                          aria-label="Salin teks prompt"
                        >
                          {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </CopyButton>
                </Group>
                <Text size="sm" className={classes.promptParagraph}>
                  {job.prompt}
                </Text>
              </div>

              {/* Spesifikasi & Metadata Gambar */}
              <div className={classes.metaProperties}>
                <div className={classes.metaRow}>
                  <Text size="xs" c="dimmed">
                    Biaya
                  </Text>
                  <Text size="xs" fw={600}>
                    {job.cost} Poin
                  </Text>
                </div>

                {job.createdAt ? (
                  <div className={classes.metaRow}>
                    <Text size="xs" c="dimmed">
                      Dibuat
                    </Text>
                    <Text size="xs" fw={500}>
                      {formatModalDate(job.createdAt)}
                    </Text>
                  </div>
                ) : null}

                {job.output?.availableUntil ? (
                  <div className={classes.metaRow}>
                    <Text size="xs" c="dimmed">
                      Masa Berlaku
                    </Text>
                    <Text size="xs" fw={500}>
                      {formatModalDateShort(job.output.availableUntil)}
                    </Text>
                  </div>
                ) : null}
              </div>
            </Stack>
          </ScrollArea>

          {/* Footer ID */}
          <div className={classes.sidebarFooter}>
            <Group justify="space-between" align="center">
              <Text size="xs" c="dimmed" ff="monospace" lineClamp={1}>
                ID: {job.id}
              </Text>
              <CopyButton value={job.id} timeout={2000}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "ID Tersalin" : "Salin ID"} withArrow position="left">
                    <ActionIcon
                      variant="subtle"
                      color={copied ? "teal" : "gray"}
                      size="xs"
                      onClick={copy}
                      aria-label="Salin ID job"
                    >
                      {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
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
