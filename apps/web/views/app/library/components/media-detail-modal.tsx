"use client";

import {
  ActionIcon,
  Badge,
  Button,
  CopyButton,
  Modal,
  ScrollArea,
  Tooltip,
} from "@mantine/core";
import { useEffect } from "react";
import type { LibraryItem } from "@/hooks/use-library";
import { formatBytes } from "@/lib/format";
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
  if (item.kind === "video") return "TEXT-TO-VIDEO";
  return "TEXT-TO-IMAGE";
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
}: {
  opened: boolean;
  onClose: () => void;
  item: LibraryItem | null;
  items: LibraryItem[];
  onSelectItem: (item: LibraryItem) => void;
}) {
  const currentIndex = items.findIndex((i) => i.id === item?.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < items.length - 1;

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

  const isVideo = item.kind === "video" || item.mime_type.startsWith("video/");
  const isGenerated = item.type === "generated";
  const displayLabel = item.prompt || item.alias || item.id;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
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
          <div className={classes.mediaViewerWrapper}>
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

              {/* Tombol Aksi Download (Hanya untuk Generated Media) */}
              {isGenerated && item.url ? (
                <Button
                  component="a"
                  href={item.url}
                  target="_blank"
                  download={`media-${item.id}`}
                  variant="filled"
                  fullWidth
                  leftSection={<DownloadIcon size={16} />}
                  className={classes.primaryDownloadBtn}
                >
                  Download
                </Button>
              ) : null}

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
  );
}
