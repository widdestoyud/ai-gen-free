"use client";

import {
  ActionIcon,
  Badge,
  Button,
  CopyButton,
  Group,
  Loader,
  Modal,
  Progress,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { useState } from "react";
import Link from "next/link";
import { ErrorAlert } from "@/components/error-alert";
import {
  hasLiveOutput,
  isJobActive,
  jobErrorMessage,
  jobStatusLabel,
  type JobView,
} from "@/lib/job-status";
import { downloadMediaFile } from "@/lib/download-media";
import type { ComputedLedgerItem } from "./credit-history";
import classes from "./task-detail-modal.module.css";

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

function AlertTriangleIcon({ size = 32 }: { size?: number }) {
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
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function formatModeLabel(mode?: string): string {
  if (!mode) return "TEXT-TO-IMAGE";
  const m = mode.toLowerCase();
  if (m === "t2i") return "TEXT-TO-IMAGE";
  if (m === "i2i") return "IMAGE-TO-IMAGE";
  if (m === "t2v") return "TEXT-TO-VIDEO";
  if (m === "i2v") return "IMAGE-TO-VIDEO";
  return mode.toUpperCase();
}

function formatDetailDate(isoString?: string | null): string {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d).replace(":", ".");
  } catch {
    return isoString;
  }
}

function formatExpiryDate(isoString?: string | null): string {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return isoString;
  }
}

export function TaskDetailModal({
  opened,
  onClose,
  job,
  loading,
  ledgerEntry,
}: {
  opened: boolean;
  onClose: () => void;
  job: JobView | null;
  loading: boolean;
  ledgerEntry: ComputedLedgerItem | null;
}) {
  if (!opened) return null;

  const displayJobId = job?.id ?? ledgerEntry?.jobId ?? ledgerEntry?.id ?? "";
  const displayPrompt = job?.prompt ?? "Pembuatan tugas render";
  const isVideo =
    job?.mode?.includes("video") || job?.output?.contentType?.startsWith("video/");
  const isFailed = job?.status === "failed";
  const isSucceeded = job?.status === "succeeded";
  const isActive = job ? isJobActive(job.status) : false;
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!job?.output?.url) return;
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
    <Modal
      opened={opened}
      onClose={onClose}
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
          <div className={classes.mediaViewerWrapper}>
            {loading ? (
              <Group justify="center" align="center" gap="sm">
                <Loader size="sm" color="blue" />
                <Text size="sm" c="dimmed">
                  Memuat data media...
                </Text>
              </Group>
            ) : isSucceeded && hasLiveOutput(job?.output) ? (
              isVideo ? (
                <video
                  src={job.output.url}
                  controls
                  autoPlay
                  loop
                  className={classes.detailMedia}
                />
              ) : (
                <img
                  src={job.output.url}
                  alt={displayPrompt}
                  className={classes.detailMedia}
                />
              )
            ) : isFailed ? (
              <div className={classes.failedStateBox}>
                <AlertTriangleIcon />
                <Text fw={600} size="md" c="red.4">
                  Generate Gagal
                </Text>
                <Text size="xs" c="dimmed" maw={320}>
                  {job ? jobErrorMessage(job.errorCode, job.errorMessage) : "Proses render tidak berhasil."}
                </Text>
              </div>
            ) : isActive && job ? (
              <div className={classes.failedStateBox}>
                <Loader size="md" color="blue" />
                <Text fw={600} size="sm">
                  {jobStatusLabel(job.status)} · {job.progressPct}%
                </Text>
                <Progress value={job.progressPct} w={200} mt="xs" />
              </div>
            ) : (
              <Text c="dimmed" size="sm">
                File media sudah tidak tersedia.
              </Text>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Detail & Aksi Media */}
        <div className={classes.detailInfoSidebar}>
          <ScrollArea type="hover" className={classes.sidebarScroll}>
            <Stack gap="md" p="md">
              {/* Status & Mode Badges */}
              <Group justify="space-between" align="center">
                <Badge variant="light" color="blue" size="md" radius="sm">
                  {formatModeLabel(job?.mode)}
                </Badge>
                {isFailed ? (
                  <Badge variant="light" color="red" size="md" radius="sm">
                    FAILED
                  </Badge>
                ) : isSucceeded ? (
                  <Badge variant="light" color="green" size="md" radius="sm">
                    COMPLETED
                  </Badge>
                ) : (
                  <Badge variant="light" color="yellow" size="md" radius="sm">
                    {job ? jobStatusLabel(job.status).toUpperCase() : "PROCESSING"}
                  </Badge>
                )}
              </Group>

              {/* Tombol Download Utama jika sukses */}
              {isSucceeded && job?.output?.url ? (
                <Button
                  onClick={() => void handleDownload()}
                  loading={isDownloading}
                  variant="filled"
                  color="dark.4"
                  size="md"
                  radius="md"
                  fullWidth
                  leftSection={<DownloadIcon size={18} />}
                  className={classes.primaryDownloadBtn}
                >
                  Download
                </Button>
              ) : isFailed ? (
                <Button
                  component={Link}
                  href="/app/generate"
                  prefetch={false}
                  variant="light"
                  color="blue"
                  size="sm"
                  radius="md"
                  fullWidth
                >
                  Generate Lagi
                </Button>
              ) : null}

              {/* Error Message jika gagal */}
              {isFailed && job ? (
                <ErrorAlert
                  message={jobErrorMessage(job.errorCode, job.errorMessage)}
                  code={job.errorCode}
                />
              ) : null}

              {/* Box Prompt */}
              <div className={classes.promptSection}>
                <Group justify="space-between" align="center" mb={6}>
                  <Text size="sm" fw={700} c="dimmed" tt="uppercase" lts={0.5}>
                    PROMPT
                  </Text>
                  <CopyButton value={displayPrompt} timeout={2000}>
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
                  {displayPrompt}
                </Text>
              </div>

              {/* Spesifikasi & Metadata Gambar */}
              <div className={classes.metaProperties}>
                <div className={classes.metaRow}>
                  <Text size="xs" c="dimmed">
                    Biaya
                  </Text>
                  <Text size="xs" fw={600}>
                    {job?.cost ?? Math.abs(ledgerEntry?.amount ?? 0)} Poin
                  </Text>
                </div>

                <div className={classes.metaRow}>
                  <Text size="xs" c="dimmed">
                    Dibuat
                  </Text>
                  <Text size="xs" fw={500}>
                    {formatDetailDate(job?.createdAt ?? ledgerEntry?.createdAt)}
                  </Text>
                </div>

                {job?.output?.availableUntil ? (
                  <div className={classes.metaRow}>
                    <Text size="xs" c="dimmed">
                      Masa Berlaku
                    </Text>
                    <Text size="xs" fw={500}>
                      {formatExpiryDate(job.output.availableUntil)}
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
                ID: {displayJobId}
              </Text>
              <CopyButton value={displayJobId} timeout={2000}>
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
  );
}
